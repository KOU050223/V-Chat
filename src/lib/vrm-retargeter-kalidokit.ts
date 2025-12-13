/**
 * VRM Retargeter using Kalidokit
 * Kalidokitを使用してMediaPipeのランドマークをVRMに適用する
 */

import * as Kalidokit from "kalidokit";
import * as THREE from "three";
import type { VRM, VRMHumanoid } from "@pixiv/three-vrm";
import type { PoseLandmark, FaceLandmark } from "@/hooks/usePoseEstimation";
import { BoneRotations, QuaternionArray } from "@/types/avatar";

/**
 * オブジェクトプーリング用の再利用可能なオブジェクト
 * 毎フレームの新規オブジェクト生成を避けてガベージコレクション負荷を軽減
 */
const tempEuler = new THREE.Euler();
const tempQuaternion = new THREE.Quaternion();
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _tempVector3 = new THREE.Vector3();

/**
 * 回転をスムーズに適用するヘルパー関数（最適化版）
 */
const applySmoothRotation = (
  bone: THREE.Object3D,
  targetRotation: { x: number; y: number; z: number; w?: number },
  smoothing: number = 0.1
): void => {
  // Quaternionかどうかを判定 (wが存在するか)
  if (targetRotation.w !== undefined) {
    // Quaternionとして直接適用
    // Kalidokitの出力がVRM互換であると仮定
    tempQuaternion.set(
      targetRotation.x,
      targetRotation.y,
      targetRotation.z,
      targetRotation.w
    );
  } else {
    // Euler回転として適用
    // VRMシーンの180度回転を考慮してY軸を反転
    tempEuler.set(
      targetRotation.x || 0,
      -(targetRotation.y || 0), // Y軸反転
      targetRotation.z || 0,
      "XYZ"
    );
    tempQuaternion.setFromEuler(tempEuler);
  }

  // ノイズ対策の閾値チェックは無効化中
  // Slerpを使って滑らかに補間
  bone.quaternion.slerp(tempQuaternion, smoothing);
};

/**
 * MediaPipeランドマークから頭の回転を直接計算 (World Landmarks対応版)
 */
const _applyHeadRotationFromLandmarks = (
  humanoid: VRMHumanoid,
  landmarks: PoseLandmark[],
  worldLandmarks: PoseLandmark[] | null = null
): void => {
  // 顔のランドマークインデックス
  const NOSE = 0;
  const LEFT_EAR = 7;
  const RIGHT_EAR = 8;
  const LEFT_EYE = 2;
  const RIGHT_EYE = 5;

  // 3D座標を使用するか、2Dのみを使用するか
  // worldLandmarksの方が回転計算には正確
  const use3D = worldLandmarks && worldLandmarks.length > 0;
  const sourceLandmarks = use3D ? worldLandmarks! : landmarks;

  const nose = sourceLandmarks[NOSE];
  const leftEar = sourceLandmarks[LEFT_EAR];
  const rightEar = sourceLandmarks[RIGHT_EAR];
  const leftEye = sourceLandmarks[LEFT_EYE];
  const rightEye = sourceLandmarks[RIGHT_EYE];

  if (!nose || !leftEye || !rightEye) return;

  let yaw = 0;
  let pitch = 0;
  let roll = 0;

  if (use3D && leftEar && rightEar) {
    // === 3D World Landmarks を使用した計算 ===

    // 耳の中点
    const earMidX = (leftEar.x + rightEar.x) / 2;
    const earMidY = (leftEar.y + rightEar.y) / 2;
    const earMidZ = (leftEar.z + rightEar.z) / 2;

    // 顔の方向ベクトル（耳の中点 -> 鼻）
    const faceDirX = nose.x - earMidX;
    const faceDirY = nose.y - earMidY;
    const faceDirZ = nose.z - earMidZ;

    // Yaw (左右の首振り) - XZ平面での角度
    // Yaw (左右の首振り)
    // 鏡像にするため符号を反転させる (以前の -PI 補正を含めて符号反転)
    // rawYaw - PI が 正面=0 だったので、 -(rawYaw - PI) = PI - rawYaw
    const rawYaw = Math.atan2(faceDirX, faceDirZ);
    yaw = -(rawYaw - Math.PI);

    // 正規化
    if (yaw < -Math.PI) yaw += Math.PI * 2;
    if (yaw > Math.PI) yaw -= Math.PI * 2;

    // Pitch (頷き)
    // 3D座標系: Y下向き(+) -> atan2で(+) -> VRM Pitch Down(+)
    // 以前の反転(-)を削除し、正しい方向(上を向いたら-Pitch)にする
    const depth = Math.sqrt(faceDirX * faceDirX + faceDirZ * faceDirZ);
    pitch = -Math.atan2(faceDirY, depth); // ユーザー報告に基づき反転 (上を向いたら上、下を向いたら下)

    // オフセットは後段で適用

    // Roll (首の傾げ)
    // 鏡像にするため反転が必要かもしれないが、まずはYaw/Pitchを優先
    const eyeDiffY = leftEye.y - rightEye.y;
    const eyeDiffX = leftEye.x - rightEye.x;
    roll = Math.atan2(eyeDiffY, eyeDiffX); // 符号反転なしで試行
  } else {
    // === 従来の簡易計算 (Fallback) ===
    // 既存ロジックを維持しつつ、少し整理
    const LEFT_SHOULDER = 11;
    const RIGHT_SHOULDER = 12;
    const leftShoulder = landmarks[LEFT_SHOULDER];
    const rightShoulder = landmarks[RIGHT_SHOULDER];

    if (!leftShoulder || !rightShoulder) return;

    const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
    const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;
    const shoulderCenterZ = (leftShoulder.z + rightShoulder.z) / 2;

    const headDirX = nose.x - shoulderCenterX;
    const headDirY = -(nose.y - shoulderCenterY);
    const headDirZ = nose.z - shoulderCenterZ;

    const length = Math.sqrt(
      headDirX * headDirX + headDirY * headDirY + headDirZ * headDirZ
    );
    if (length < 0.01) return;

    const normalizedX = headDirX / length;
    const normalizedY = headDirY / length;
    const normalizedZ = headDirZ / length;

    yaw = Math.atan2(normalizedX, -normalizedZ);
    pitch = Math.asin(-normalizedY) + 0.3;

    if (leftEye && rightEye) {
      const eyeDiffY = leftEye.y - rightEye.y;
      roll = Math.atan2(eyeDiffY, leftEye.x - rightEye.x);
    }
  }

  // 感度調整 (1.0 = 100%)
  const YAW_SENSITIVITY = 1.0;
  const PITCH_SENSITIVITY = 1.0;
  const ROLL_SENSITIVITY = 1.0;

  // 頭のボーンに適用
  const head = humanoid.getNormalizedBoneNode("head");
  if (head) {
    // 補正: デフォルトの向きを調整
    // ピッチ反転に伴い、オフセットも調整。まずは0（真正面）に戻す
    const correctedPitch = pitch;

    tempEuler.set(
      correctedPitch * PITCH_SENSITIVITY,
      yaw * YAW_SENSITIVITY,
      roll * ROLL_SENSITIVITY // Rollも反転なしで試行
    );
    tempQuaternion.setFromEuler(tempEuler);

    // ノイズ対策: 変化が小さい場合は更新しない (1度未満は無視)
    const angle = head.quaternion.angleTo(tempQuaternion);
    if (angle > 0.02) {
      head.quaternion.slerp(tempQuaternion, 0.1); // 0.2 -> 0.1 にしてスムーズに
    }
  }

  // 首のボーンにも軽く適用
  const neck = humanoid.getNormalizedBoneNode("neck");
  if (neck) {
    tempEuler.set(
      pitch * 0.3 * PITCH_SENSITIVITY,
      yaw * 0.3 * YAW_SENSITIVITY,
      roll * 0.3 * ROLL_SENSITIVITY
    );
    tempQuaternion.setFromEuler(tempEuler);
    neck.quaternion.slerp(tempQuaternion, 0.4);
  }
};

/**
 * Kalidokitを使用してポーズデータをVRMに適用する
 */
export const retargetPoseToVRMWithKalidokit = (
  vrm: VRM,
  landmarks: PoseLandmark[],
  worldLandmarks: PoseLandmark[] | null = null,
  faceLandmarks: FaceLandmark[] | null = null,
  imageSize: { width: number; height: number } = { width: 640, height: 480 }
): void => {
  if (!vrm.humanoid || landmarks.length === 0) {
    return;
  }

  try {
    // --- Facial Expression Retargeting ---
    if (faceLandmarks && faceLandmarks.length > 0) {
      const faceRig = Kalidokit.Face.solve(faceLandmarks, {
        runtime: "mediapipe",
        imageSize: imageSize,
      });

      if (faceRig && vrm.expressionManager) {
        // Apply Blink
        // Kalidokit results: { l: 0-1, r: 0-1 } (0=Open, 1=Closed)
        // VRM Blink: 0=Open, 1=Closed
        const blinkL = faceRig.eye.l;
        const blinkR = faceRig.eye.r;

        // Apply to VRM ExpressionManager
        const blinkValL = 1 - blinkL;
        const blinkValR = 1 - blinkR;

        // Mirroring: Swap Left/Right
        // User Left Eye (blinkValL) -> Avatar Right Eye (TargetRight)
        // User Right Eye (blinkValR) -> Avatar Left Eye (TargetLeft)
        const targetRight = blinkValL;
        const targetLeft = blinkValR;

        // Split Logic to avoid additive distortion while supporting legacy "Blink"
        const combinedBlink = Math.min(targetLeft, targetRight);
        const remLeft = targetLeft - combinedBlink;
        const remRight = targetRight - combinedBlink;

        // Log available expressions once for debugging
        if (Math.random() < 0.01) {
          // Low frequency log
          console.log("VRM Expressions:", vrm.expressionManager.expressionMap);
          console.log("Blink Split:", {
            combined: combinedBlink,
            left: remLeft,
            right: remRight,
          });
        }

        // VRM 1.0 standard (blink, blinkLeft, blinkRight)
        vrm.expressionManager.setValue("blink", combinedBlink);
        vrm.expressionManager.setValue("blinkLeft", remLeft);
        vrm.expressionManager.setValue("blinkRight", remRight);

        // VRM 0.0 legacy (Blink, BlinkL, BlinkR)
        vrm.expressionManager.setValue("Blink", combinedBlink);
        vrm.expressionManager.setValue("BlinkL", remLeft);
        vrm.expressionManager.setValue("BlinkR", remRight);

        // Apply Mouth (Vowels)
        const mouthShape = faceRig.mouth.shape;
        // Basic Vowels (Removed unused variables: aa, ih, ou, ee, oh)

        // Apply Smile & Emotions based on Mouth & Brows
        // Happy: Mouth corners up (smile) + Brows raised/relaxed
        // Angry: Brows lowered/furrowed
        // Sorrow: Brows tiled upwards? (Simplification: just use generic "Sorrow" if Brows are sad-shaped)

        // Kalidokit gives us:
        // faceRig.brow = 0 (low) to 1 (high) typically

        // Brows: 0 - 1 (1 is raised)
        // Note: Kalidokit type definition might define brow as number or {l, r} depending on version.
        // If it's a number, use it for both.
        let browL = 0;
        let browR = 0;

        if (faceRig.brow) {
          if (typeof faceRig.brow === "number") {
            browL = faceRig.brow;
            browR = faceRig.brow;
          } else if (typeof faceRig.brow === "object") {
            const browObj = faceRig.brow as { l?: number; r?: number };
            browL = browObj.l || 0;
            browR = browObj.r || 0;
          }
        }

        const browAvg = (browL + browR) / 2;

        // Smile Detection (Heuristic)
        // Mouth X (width): increases when smiling
        // Mouth Y (open): high for 'a', 'o', but smile is usually closed or slightly open wide.
        const mouthX = faceRig.mouth.x || 0; // Width
        // const mouthY = faceRig.mouth.y || 0; // Openness (Unused)

        // Experimental Smile Logic: Wide mouth + Not too open
        // specific threshold needs tuning based on logs.
        // Usually width > 0.3 might be a smile?
        const smileFactor = Math.max(0, (mouthX - 0.2) * 3);

        // Debug Log (Throttled)
        if (Math.random() < 0.05) {
          console.log("Face Debug Enhanced:", {
            brow: faceRig.brow,
            pupil: faceRig.pupil,
            mouth: faceRig.mouth,
            calcJoy: smileFactor + browAvg,
            calcAngry: 0, // Temporarily disabled
          });
        }

        // Logic Update:
        // Joy = Smile (mouth width) + Brow Raise
        // Angry = 0 (Brow down is hard to detect with just 'brow' 0-1 if 0 is neutral)

        const joyValue = Math.min(1, smileFactor + browAvg);
        const angryValue = 0; // Disable to remove "frozen angry face"

        // Smoothing Helper
        const lerp = (current: number, target: number, speed: number) => {
          return current * (1 - speed) + target * speed;
        };

        // Get current values to smooth
        const currentJoy = vrm.expressionManager?.getValue("Joy") || 0;
        const currentAngry = vrm.expressionManager?.getValue("Angry") || 0;

        // Apply Smoothed Expressions
        const smoothing = 0.2;
        vrm.expressionManager?.setValue(
          "Joy",
          lerp(currentJoy, joyValue, smoothing)
        );
        vrm.expressionManager?.setValue(
          "Angry",
          lerp(currentAngry, angryValue, smoothing)
        );

        // Apply Vowels (Smoothed)
        ["aa", "ih", "ou", "ee", "oh"].forEach((vowel) => {
          const target =
            mouthShape[
              vowel.toUpperCase() === "IH"
                ? "I"
                : vowel.toUpperCase() === "OH"
                  ? "O"
                  : vowel.toUpperCase() === "AA"
                    ? "A"
                    : vowel.toUpperCase() === "EE"
                      ? "E"
                      : "U"
            ] || 0;
          const current = vrm.expressionManager?.getValue(vowel) || 0;
          // Mouth moves fast, so less smoothing
          vrm.expressionManager?.setValue(vowel, lerp(current, target, 0.4));
        });

        // --- Pupil (Gaze) Tracking ---
        if (faceRig.pupil) {
          // Kalidokit pupil: { x, y } -1 to 1 range (approx)
          // VRM LookAt is usually controlled by `vrm.lookAt.target` (Vector3 position)
          // We need to set a target position relative to the head.

          const pupilX = faceRig.pupil.x; // -1(left) ... 1(right)
          const pupilY = faceRig.pupil.y; // -1(up) ... 1(down) ? Check Kalidokit spec.
          // Actually Kalidokit `pupil`: x range [-1, 1], y range [-1, 1]
          // VRM LookAt Target implies a position in world space to look at.

          // Define a virtual target distance
          // const DISTANCE = 10.0; (Unused)

          // X: Left/Right (Mirroring already handled by Kalidokit?
          // Usually user looks left -> pupil.x is -1. Avatar should look right (its left) -> x = +1.
          // Let's try direct mapping first, then flip if needed.
          // Kalidokit does no mirroring by default for pupils usually.
          // Mirroring: User Look Left (screen left) -> Avatar Look Right (screen right, its Left).
          // So if user.x = -1 (Left), Avatar.x should be +1 (Left).
          // Wait, "Avatar Left" means +X in local head space? No, usually +X is Left in VRM/GLTF Humanoid?
          // Let's use vrm.lookAt.applier IF available, but `target` is safer.

          // Basic approximation:
          // Calculate offset from head position
          const headNode = vrm.humanoid.getNormalizedBoneNode("head");
          if (headNode && vrm.lookAt) {
            // We want to construct a target position in World Space
            // Head Position + Forward * Distance + Offset(x,y)
            // But wait, VRM `lookAt.target` is an Object3D usually?
            // Pixiv Three-VRM v3 uses a `LookAt` class which might have `target` as a property update.
            // Actually we usually just set `vrm.lookAt.target.position`.

            // If the app doesn't have a dedicated lookAt target object in the scene,
            // we might be fighting with other logic.
            // Assuming we can control it here:

            // Create a relative vector
            // Mirror X for "Mirror effect"
            const sensitivity = 0.5; // Reduced from 1.5 to 0.7 for stability, user reported "too intense". Actually let's try 0.5 for stability.
            const lookAtX = -pupilX * sensitivity;

            // Y-axis: User reported inversion (Up -> Down).
            // Prev code: `const lookAtY = -pupilY * 1.5;`
            // If pupilY is negative for Up, then -(-1) = 1 (Positive Pitch) -> Down (if Pitch+ is Down).
            // So we should NOT invert logic if we want Up (-Y) -> Up (Negative Pitch).
            // Let's use `pupilY * sensitivity`.
            const lookAtY = pupilY * sensitivity + 0.05; // Added slight offset to prevent "sleepy eyes" look

            // Logging for Gaze
            if (Math.random() < 0.01) {
              console.log("Gaze Debug:", { pupilX, pupilY, lookAtX, lookAtY });
            }

            const leftEye = vrm.humanoid.getNormalizedBoneNode("leftEye");
            const rightEye = vrm.humanoid.getNormalizedBoneNode("rightEye");

            if (leftEye && rightEye) {
              // Create LookAt rotation
              // Yaw (Y-axis), Pitch (X-axis)
              const yaw = lookAtX * 1.0;
              const pitch = lookAtY * 1.0;

              const euler = new THREE.Euler(pitch, yaw, 0, "XYZ");
              const quat = new THREE.Quaternion().setFromEuler(euler);

              // Slerp for smooth eyes
              // 0.2 -> 0.1 for more smoothing
              leftEye.quaternion.slerp(quat, 0.1);
              rightEye.quaternion.slerp(quat, 0.1);
            }
          }
        }
      }
    }

    // MediaPipeのランドマークをKalidokitの形式に変換
    const poseLandmarks = landmarks.map((landmark) => ({
      x: landmark.x,
      y: landmark.y,
      z: landmark.z,
      visibility: landmark.visibility,
    }));

    // worldLandmarksも変換（3D空間座標）
    const worldLandmarksFormatted = worldLandmarks
      ? worldLandmarks.map((landmark) => ({
          x: landmark.x,
          y: landmark.y,
          z: landmark.z,
          visibility: landmark.visibility,
        }))
      : poseLandmarks;

    // Kalidokitでポーズを解析
    // worldLandmarksを使用することで正確な3D回転を計算
    const riggedPose = Kalidokit.Pose.solve(
      poseLandmarks,
      worldLandmarksFormatted,
      {
        runtime: "mediapipe",
        enableLegs: true,
      }
    );

    if (!riggedPose) {
      return;
    }

    const humanoid = vrm.humanoid;

    // 腰（Hips）の回転を完全に無効化（ビデオ会議用）
    // ビデオ会議では常にカメラを向いているため、Hipsの回転は不要
    // 回転を適用すると体を傾けたときに不自然な回転が発生する
    // 体の傾きはSpineとChestで表現する
    /*
    if (riggedPose.Hips && riggedPose.Hips.rotation) {
      const hips = humanoid.getNormalizedBoneNode('hips');
      if (hips) {
        applySmoothRotation(hips, riggedPose.Hips.rotation, 0.5);
      }
    }
    */

    // 背骨（Spine）の回転 - 体の傾きを主に表現
    // ユーザー要望によりトラッキングを強化: 0.4 -> 0.7 (より大きく動くように)
    if (riggedPose.Spine) {
      const spine = humanoid.getNormalizedBoneNode("spine");
      if (spine) {
        const spineRotation = {
          x: (riggedPose.Spine.x || 0) * 0.7,
          y: (riggedPose.Spine.y || 0) * 0.7,
          z: (riggedPose.Spine.z || 0) * 0.7,
        };
        applySmoothRotation(spine, spineRotation, 0.1);
      }

      // 上部背骨（Chest）にも補助的な動きを追加
      // 0.2 -> 0.3 に強化
      const chest = humanoid.getNormalizedBoneNode("chest");
      if (chest) {
        const chestRotation = {
          x: (riggedPose.Spine.x || 0) * 0.3,
          y: (riggedPose.Spine.y || 0) * 0.3,
          z: (riggedPose.Spine.z || 0) * 0.3,
        };
        applySmoothRotation(chest, chestRotation, 0.1);
      }
    }

    // Cast to access optional Shoulder/Hand properties
    const pose = riggedPose as unknown as {
      LeftShoulder?: { x: number; y: number; z: number };
      RightShoulder?: { x: number; y: number; z: number };
      LeftHand?: { x: number; y: number; z: number };
      RightHand?: { x: number; y: number; z: number };
    };

    if (pose.LeftShoulder) {
      const leftShoulder = humanoid.getNormalizedBoneNode("leftShoulder");
      if (leftShoulder) {
        // 肩の動きを強化: 0.5 -> 0.7
        const rotation = {
          x: (pose.LeftShoulder.x || 0) * 0.7,
          y: (pose.LeftShoulder.y || 0) * 0.7,
          z: (pose.LeftShoulder.z || 0) * 0.7,
        };
        applySmoothRotation(leftShoulder, rotation, 0.2);
      }
    }

    if (pose.RightShoulder) {
      const rightShoulder = humanoid.getNormalizedBoneNode("rightShoulder");
      if (rightShoulder) {
        const rotation = {
          x: (pose.RightShoulder.x || 0) * 0.7,
          y: (pose.RightShoulder.y || 0) * 0.7,
          z: (pose.RightShoulder.z || 0) * 0.7,
        };
        applySmoothRotation(rightShoulder, rotation, 0.2);
      }
    }

    if (landmarks.length > 0) {
      _applyHeadRotationFromLandmarks(humanoid, landmarks, worldLandmarks);
    }

    // Kalidokitが返すTPose型にはChest, Neck, Headがないため、手動実装は保留

    // 左腕（応答性と精度を向上）
    if (riggedPose.LeftUpperArm) {
      const leftUpperArm = humanoid.getNormalizedBoneNode("leftUpperArm");
      if (leftUpperArm) {
        applySmoothRotation(leftUpperArm, riggedPose.LeftUpperArm, 0.4); // 0.15 -> 0.4
      }
    } else {
      // debug logging for tracking loss
      if (Math.random() < 0.01) console.log("LeftUpperArm tracking lost");
    }

    if (riggedPose.LeftLowerArm) {
      const leftLowerArm = humanoid.getNormalizedBoneNode("leftLowerArm");
      if (leftLowerArm) {
        applySmoothRotation(leftLowerArm, riggedPose.LeftLowerArm, 0.4); // 0.15 -> 0.4
      }
    } else {
      if (Math.random() < 0.01) console.log("LeftLowerArm tracking lost");
    }

    // 右腕（応答性と精度を向上）
    if (riggedPose.RightUpperArm) {
      const rightUpperArm = humanoid.getNormalizedBoneNode("rightUpperArm");
      if (rightUpperArm) {
        // DEBUG: Check values
        if (Math.random() < 0.01) {
          console.log("RightUpperArm Rig:", riggedPose.RightUpperArm);
          console.log("RightUpperArm Bone:", rightUpperArm.rotation);
        }
        applySmoothRotation(rightUpperArm, riggedPose.RightUpperArm, 0.4); // 0.15 -> 0.4
      } else {
        console.warn("RightUpperArm bone not found");
      }
    } else {
      if (Math.random() < 0.01) console.log("RightUpperArm tracking lost");
    }

    // 左手首（Hand）
    if (pose.LeftHand) {
      const leftHand = humanoid.getNormalizedBoneNode("leftHand");
      if (leftHand) {
        // 手首は表情豊かに動くので少し感度高めでも良いが、ノイズも拾いやすい
        const rotation = {
          x: pose.LeftHand.x || 0,
          y: pose.LeftHand.y || 0,
          z: pose.LeftHand.z || 0,
        };
        applySmoothRotation(leftHand, rotation, 0.4); // 0.2 -> 0.4
      }
    } else {
      if (Math.random() < 0.01) console.log("LeftHand tracking lost");
    }

    if (riggedPose.RightLowerArm) {
      const rightLowerArm = humanoid.getNormalizedBoneNode("rightLowerArm");
      if (rightLowerArm) {
        applySmoothRotation(rightLowerArm, riggedPose.RightLowerArm, 0.4); // 0.15 -> 0.4
      }
    } else {
      if (Math.random() < 0.01) console.log("RightLowerArm tracking lost");
    }

    // 右手首（Hand）
    if (pose.RightHand) {
      const rightHand = humanoid.getNormalizedBoneNode("rightHand");
      if (rightHand) {
        const rotation = {
          x: pose.RightHand.x || 0,
          y: pose.RightHand.y || 0,
          z: pose.RightHand.z || 0,
        };
        applySmoothRotation(rightHand, rotation, 0.4); // 0.2 -> 0.4
      }
    } else {
      if (Math.random() < 0.01) console.log("RightHand tracking lost");
    }

    // 脚の動きは最小限に（ビデオ会議用 - 座位想定）
    // スムージングを非常に強くして急激な動きを抑制
    if (riggedPose.LeftUpperLeg) {
      const leftUpperLeg = humanoid.getNormalizedBoneNode("leftUpperLeg");
      if (leftUpperLeg) {
        applySmoothRotation(leftUpperLeg, riggedPose.LeftUpperLeg, 0.05); // 0.3 → 0.9 超安定化
      }
    }

    if (riggedPose.LeftLowerLeg) {
      const leftLowerLeg = humanoid.getNormalizedBoneNode("leftLowerLeg");
      if (leftLowerLeg) {
        applySmoothRotation(leftLowerLeg, riggedPose.LeftLowerLeg, 0.05); // 0.3 → 0.9
      }
    }

    if (riggedPose.RightUpperLeg) {
      const rightUpperLeg = humanoid.getNormalizedBoneNode("rightUpperLeg");
      if (rightUpperLeg) {
        applySmoothRotation(rightUpperLeg, riggedPose.RightUpperLeg, 0.05); // 0.3 → 0.9
      }
    }

    if (riggedPose.RightLowerLeg) {
      const rightLowerLeg = humanoid.getNormalizedBoneNode("rightLowerLeg");
      if (rightLowerLeg) {
        applySmoothRotation(rightLowerLeg, riggedPose.RightLowerLeg, 0.05); // 0.3 → 0.9
      }
    }
  } catch (error) {
    console.error("❌ Kalidokitでのリターゲッティングエラー:", error);
  }
};

/**
 * Kalidokitを使用してポーズデータを計算し、回転情報を返す（VRMへの直接適用はしない）
 * 送信用データの生成に使用
 * @param landmarks - MediaPipeのポーズランドマーク（必須）
 * @param worldLandmarks - 3D空間座標のランドマーク（オプション、nullの場合はlandmarksを使用）
 * @returns 上半身のボーン回転データ（spine, chest, arms）。計算失敗時はnull。
 * @note 脚の回転は含まれません（ビデオ会議の座位想定のため）
 */

export const calculateRiggedPose = (
  landmarks: PoseLandmark[],
  worldLandmarks: PoseLandmark[] | null = null,
  faceLandmarks: FaceLandmark[] | null = null,
  imageSize: { width: number; height: number } = { width: 640, height: 480 }
): { bones: BoneRotations; blendShapes: Record<string, number> } | null => {
  if (landmarks.length === 0) {
    return null;
  }

  try {
    // MediaPipeのランドマークをKalidokitの形式に変換
    const poseLandmarks = landmarks.map((landmark) => ({
      x: landmark.x,
      y: landmark.y,
      z: landmark.z,
      visibility: landmark.visibility,
    }));

    const worldLandmarksFormatted = worldLandmarks
      ? worldLandmarks.map((landmark) => ({
          x: landmark.x,
          y: landmark.y,
          z: landmark.z,
          visibility: landmark.visibility,
        }))
      : poseLandmarks;

    const riggedPose = Kalidokit.Pose.solve(
      poseLandmarks,
      worldLandmarksFormatted,
      {
        runtime: "mediapipe",
        enableLegs: true,
      }
    );

    if (!riggedPose) {
      return null;
    }

    const rotations: BoneRotations = {};

    // Helper to convert Kalidokit rotation to QuaternionArray
    const toQuaternion = (rotation: {
      x: number;
      y: number;
      z: number;
      w?: number;
    }): QuaternionArray => {
      // Quaternion case (Hips often)
      if (rotation.w !== undefined) {
        return [rotation.x, rotation.y, rotation.z, rotation.w];
      }

      // Euler case - Match applySmoothRotation logic (Y-axis inversion for VRM 180 rot)
      const x = rotation.x || 0;
      const y = -(rotation.y || 0); // Invert Y
      const z = rotation.z || 0;

      const q = new THREE.Quaternion();
      const e = new THREE.Euler(x, y, z, "XYZ");
      q.setFromEuler(e);
      return [q.x, q.y, q.z, q.w];
    };

    if (riggedPose.Hips && riggedPose.Hips.rotation) {
      // Optional: Include Hips if needed
      // rotations.hips = toQuaternion(riggedPose.Hips.rotation);
    }

    if (riggedPose.Spine) rotations.spine = toQuaternion(riggedPose.Spine);
    if (riggedPose.Spine) {
      // Infer chest from spine
      const chestRot = {
        x: (riggedPose.Spine.x || 0) * 0.3, // Matched local: 0.3
        y: (riggedPose.Spine.y || 0) * 0.3,
        z: (riggedPose.Spine.z || 0) * 0.3,
      };
      rotations.chest = toQuaternion(chestRot);
    }

    // Cast to access optional Shoulder/Hand properties
    const pose = riggedPose as unknown as {
      LeftShoulder?: { x: number; y: number; z: number };
      RightShoulder?: { x: number; y: number; z: number };
      LeftHand?: { x: number; y: number; z: number };
      RightHand?: { x: number; y: number; z: number };
    };

    if (pose.LeftShoulder) {
      const scaled = {
        x: (pose.LeftShoulder.x || 0) * 0.7, // Matched local: 0.7
        y: (pose.LeftShoulder.y || 0) * 0.7,
        z: (pose.LeftShoulder.z || 0) * 0.7,
      };
      rotations.leftShoulder = toQuaternion(scaled);
    }

    if (pose.RightShoulder) {
      const scaled = {
        x: (pose.RightShoulder.x || 0) * 0.7, // Matched local: 0.7
        y: (pose.RightShoulder.y || 0) * 0.7,
        z: (pose.RightShoulder.z || 0) * 0.7,
      };
      rotations.rightShoulder = toQuaternion(scaled);
    }

    if (riggedPose.LeftUpperArm)
      rotations.leftUpperArm = toQuaternion(riggedPose.LeftUpperArm);
    if (riggedPose.LeftLowerArm)
      rotations.leftLowerArm = toQuaternion(riggedPose.LeftLowerArm);

    // 手首 (Hand) - Left
    if (pose.LeftHand) {
      rotations.leftHand = toQuaternion(pose.LeftHand);
    }

    if (riggedPose.RightUpperArm)
      rotations.rightUpperArm = toQuaternion(riggedPose.RightUpperArm);
    if (riggedPose.RightLowerArm)
      rotations.rightLowerArm = toQuaternion(riggedPose.RightLowerArm);

    // 手首 (Hand) - Right
    if (pose.RightHand) {
      rotations.rightHand = toQuaternion(pose.RightHand);
    }
    // --- Facial Expression Calculation ---
    const blendShapes: Record<string, number> = {};

    if (faceLandmarks && faceLandmarks.length > 0) {
      const faceRig = Kalidokit.Face.solve(faceLandmarks, {
        runtime: "mediapipe",
        imageSize: imageSize,
      });

      if (faceRig) {
        // Blink
        // Kalidokit gives 0(Open) - 1(Closed) usually, but check prev logic:
        // "blinkL = faceRig.eye.l" (0 to 1). VRM blink is 0 to 1.
        // PREVIOUS LOGIC in retargetPoseToVRMWithKalidokit:
        // const blinkL = faceRig.eye.l;
        // const blinkValL = 1 - blinkL;
        // This implies faceRig.eye.l is 1(Open) to 0(Closed)?
        // Kalidokit docs say eye.l is "Eye openness" (1=open, 0=closed).
        // VRM Blink is "Weight of Blink" (0=open, 1=closed).
        // So VRM = 1 - Kalidokit.

        const blinkOpenL = faceRig.eye.l || 0;
        const blinkOpenR = faceRig.eye.r || 0;

        const blinkValL = 1 - blinkOpenL;
        const blinkValR = 1 - blinkOpenR;

        // Mirroring: User Left -> Avatar Right
        const targetRight = blinkValL;
        const targetLeft = blinkValR;

        const combinedBlink = Math.min(targetLeft, targetRight);
        const remLeft = targetLeft - combinedBlink;
        const remRight = targetRight - combinedBlink;

        blendShapes["blink"] = combinedBlink;
        blendShapes["blinkLeft"] = remLeft;
        blendShapes["blinkRight"] = remRight;

        // Vowels
        const mouthShape = faceRig.mouth.shape;
        // VRM 0.0 / 1.0 Preset Names
        // Typical VRM uses ["aa", "ih", "ou", "ee", "oh"] or ["A", "I", "U", "E", "O"]
        // Let's use standard Preset names. V-Chat seems to use standard VRM.
        // Previous logic: vrm.expressionManager.setValue("aa", ...);
        blendShapes["aa"] = mouthShape.A || 0;
        blendShapes["ih"] = mouthShape.I || 0;
        blendShapes["ou"] = mouthShape.U || 0;
        blendShapes["ee"] = mouthShape.E || 0;
        blendShapes["oh"] = mouthShape.O || 0;

        // Joy
        // Logic from retargetPoseToVRMWithKalidokit
        let browL = 0;
        let browR = 0;
        if (faceRig.brow) {
          if (typeof faceRig.brow === "number") {
            browL = browR = faceRig.brow;
          } else {
            browL = (faceRig.brow as { l?: number; r?: number }).l || 0;
            browR = (faceRig.brow as { l?: number; r?: number }).r || 0;
          }
        }
        const browAvg = (browL + browR) / 2;
        const mouthX = faceRig.mouth.x || 0;
        // smileFactor = Math.max(0, (mouthX - 0.2) * 3);
        const smileFactor = Math.max(0, (mouthX - 0.2) * 3);
        const joyValue = Math.min(1, smileFactor + browAvg);

        blendShapes["Joy"] = joyValue;

        // Angry = 0 per previous logic
      }
    }

    return { bones: rotations, blendShapes };
  } catch (error) {
    console.error("❌ Error calculating rigged pose:", error);
    return null;
  }
};
