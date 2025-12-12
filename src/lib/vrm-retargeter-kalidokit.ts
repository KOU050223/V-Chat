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
  targetRotation: { x: number; y: number; z: number },
  smoothing: number = 0.1 // 0.5 → 0.3 に戻して応答性向上
): void => {
  // 再利用可能なオブジェクトを使用（毎回新規作成しない）
  // VRMシーンの180度回転を考慮してY軸を反転
  tempEuler.set(
    targetRotation.x || 0,
    targetRotation.y || 0, // Y軸反転（VRMシーンの180度回転を考慮）
    targetRotation.z || 0,
    "XYZ"
  );
  tempQuaternion.setFromEuler(tempEuler);

  // 【追加】現在の角度と目標角度の差を計算
  const angle = bone.quaternion.angleTo(tempQuaternion);
  // 【追加】変化が小さすぎる場合（例: 2度未満）は更新しない（ノイズ対策）
  // ※ 0.035ラジアン ≒ 2度
  if (angle < 0.035) {
    return;
  }
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
    pitch = Math.atan2(faceDirY, depth);

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
    // 補正: デフォルトで少し下を向いてしまうため、オフセットを引いて補正
    // (Pitchが正=下向き なので、引くことで上向きに補正)
    const correctedPitch = pitch - 0.4;

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
  faceLandmarks: FaceLandmark[] | null = null
): void => {
  if (!vrm.humanoid || landmarks.length === 0) {
    return;
  }

  try {
    // --- Facial Expression Retargeting ---
    if (faceLandmarks && faceLandmarks.length > 0) {
      const faceRig = Kalidokit.Face.solve(faceLandmarks, {
        runtime: "mediapipe",
        imageSize: { width: 640, height: 480 },
      });

      if (faceRig && vrm.expressionManager) {
        // Apply Blink
        // Kalidokit results: { l: 0-1, r: 0-1 } (0=Open, 1=Closed)
        // VRM Blink: 0=Open, 1=Closed
        const blinkL = faceRig.eye.l;
        const blinkR = faceRig.eye.r;

        // Apply to VRM ExpressionManager
        vrm.expressionManager.setValue("blink_l", 1 - blinkL); // Kalidokit seems to return 1 for open? Check docs.
        // Documentation says: 1 is open, 0 is closed for Kalidokit?
        // Wait, Kalidokit docs: "0 - 1 Refers to the openness of the eye"
        // VRM Blink: 1.0 is Closed.
        // So VRM Blink = 1 - Kalidokit Openness.

        // Let's verify Kalidokit output. Usually it matches standard blendshapes.
        // If Kalidokit "l" is "Eye Openness":
        // VRM "Blink" = 1 - l
        vrm.expressionManager.setValue("blink_left", 1 - blinkL);
        vrm.expressionManager.setValue("blink_right", 1 - blinkR);

        // Apply Mouth
        // Kalidokit mouth: { x, y, shape: { A, E, I, O, U } }
        const mouthShape = faceRig.mouth.shape;

        // VRM AEIOU
        vrm.expressionManager.setValue("aa", mouthShape.A);
        vrm.expressionManager.setValue("ih", mouthShape.I);
        vrm.expressionManager.setValue("ou", mouthShape.U);
        vrm.expressionManager.setValue("ee", mouthShape.E);
        vrm.expressionManager.setValue("oh", mouthShape.O);

        // If satisfied, we can also use general mouth open if vowels aren't good
        // vrm.expressionManager.setValue("neutral", ...);
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
    if (riggedPose.Spine) {
      const spine = humanoid.getNormalizedBoneNode("spine");
      if (spine) {
        const spineRotation = {
          x: (riggedPose.Spine.x || 0) * 0.2, // 前後の傾きを20%に
          y: (riggedPose.Spine.y || 0) * 0.2, // 左右の回転を20%に
          z: (riggedPose.Spine.z || 0) * 0.2, // 左右の傾きを20%に
        };
        applySmoothRotation(spine, spineRotation, 0.1);
      }

      // 上部背骨（Chest）にも補助的な動きを追加
      const chest = humanoid.getNormalizedBoneNode("chest");
      if (chest) {
        const chestRotation = {
          x: (riggedPose.Spine.x || 0) * 0.1,
          y: (riggedPose.Spine.y || 0) * 0.1,
          z: (riggedPose.Spine.z || 0) * 0.1,
        };
        applySmoothRotation(chest, chestRotation, 0.1);
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
        applySmoothRotation(leftUpperArm, riggedPose.LeftUpperArm, 0.15); // 0.3 → 0.2
      }
    }

    if (riggedPose.LeftLowerArm) {
      const leftLowerArm = humanoid.getNormalizedBoneNode("leftLowerArm");
      if (leftLowerArm) {
        applySmoothRotation(leftLowerArm, riggedPose.LeftLowerArm, 0.15); // 0.3 → 0.2
      }
    }

    // 右腕（応答性と精度を向上）
    if (riggedPose.RightUpperArm) {
      const rightUpperArm = humanoid.getNormalizedBoneNode("rightUpperArm");
      if (rightUpperArm) {
        applySmoothRotation(rightUpperArm, riggedPose.RightUpperArm, 0.15); // 0.3 → 0.2
      }
    }

    if (riggedPose.RightLowerArm) {
      const rightLowerArm = humanoid.getNormalizedBoneNode("rightLowerArm");
      if (rightLowerArm) {
        applySmoothRotation(rightLowerArm, riggedPose.RightLowerArm, 0.15); // 0.3 → 0.2
      }
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
  worldLandmarks: PoseLandmark[] | null = null
): BoneRotations | null => {
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
        x: (riggedPose.Spine.x || 0) * 0.5,
        y: (riggedPose.Spine.y || 0) * 0.5,
        z: (riggedPose.Spine.z || 0) * 0.5,
      };
      rotations.chest = toQuaternion(chestRot);
    }

    if (riggedPose.LeftUpperArm)
      rotations.leftUpperArm = toQuaternion(riggedPose.LeftUpperArm);
    if (riggedPose.LeftLowerArm)
      rotations.leftLowerArm = toQuaternion(riggedPose.LeftLowerArm);
    if (riggedPose.RightUpperArm)
      rotations.rightUpperArm = toQuaternion(riggedPose.RightUpperArm);
    if (riggedPose.RightLowerArm)
      rotations.rightLowerArm = toQuaternion(riggedPose.RightLowerArm);

    return rotations;
  } catch (error) {
    console.error("❌ Error calculating rigged pose:", error);
    return null;
  }
};
