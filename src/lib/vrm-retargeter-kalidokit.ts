/**
 * VRM Retargeter using Kalidokit
 * Kalidokitを使用してMediaPipeのランドマークをVRMに適用する
 */

import * as Kalidokit from 'kalidokit';
import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import type { PoseLandmark } from '@/types/mediapipe';

/**
 * オブジェクトプーリング用の再利用可能なオブジェクト
 * 毎フレームの新規オブジェクト生成を避けてガベージコレクション負荷を軽減
 */
const tempEuler = new THREE.Euler();
const tempQuaternion = new THREE.Quaternion();
const tempVector3 = new THREE.Vector3();

/**
 * 部位ごとの最適なスムージング係数
 * 値が小さいほど反応が速く、大きいほど滑らか
 */
const SMOOTHING_FACTORS = {
  head: 0.3,        // 頭: 中程度の反応性
  neck: 0.3,        // 首: 頭と同じ
  spine: 0.3,       // 背骨: 中程度
  chest: 0.3,       // 胸: 中程度
  upperArm: 0.15,   // 上腕: 高反応性（腕の動きは重要）
  lowerArm: 0.15,   // 前腕: 高反応性
  upperLeg: 0.9,    // 太もも: 超安定（ビデオ会議用）
  lowerLeg: 0.9,    // すね: 超安定
  hand: 0.2         // 手: 中高反応性
} as const;

/**
 * 回転をスムーズに適用するヘルパー関数（最適化版）
 * 動きの速度に応じた動的スムージングを実装
 */
const applySmoothRotation = (
  bone: THREE.Object3D,
  targetRotation: { x: number; y: number; z: number },
  baseSmoothing: number = 0.3
): void => {
  // 再利用可能なオブジェクトを使用（毎回新規作成しない）
  tempEuler.set(
    targetRotation.x || 0,
    targetRotation.y || 0,
    targetRotation.z || 0,
    'XYZ'
  );
  tempQuaternion.setFromEuler(tempEuler);

  // 現在の回転との角度差を計算（動きの速度を判定）
  const angleDiff = bone.quaternion.angleTo(tempQuaternion);
  
  // 動きが大きい場合は反応を速く、小さい場合は滑らかに
  // 角度差が大きい（>0.5ラジアン）場合はスムージングを弱める
  const dynamicSmoothing = angleDiff > 0.5 
    ? baseSmoothing * 0.7  // 動きが大きい時は30%速く
    : baseSmoothing;        // 通常時はそのまま

  // Slerpを使って滑らかに補間
  bone.quaternion.slerp(tempQuaternion, dynamicSmoothing);
};

/**
 * MediaPipeランドマークから頭の回転を直接計算
 * VRMの座標系に合わせて変換
 */
const applyHeadRotationFromLandmarks = (
  humanoid: any,
  landmarks: PoseLandmark[],
  worldLandmarks: PoseLandmark[] | null = null
): void => {
  // 顔のランドマークインデックス
  const NOSE = 0;
  const LEFT_EYE = 2;
  const RIGHT_EYE = 5;
  const LEFT_SHOULDER = 11;
  const RIGHT_SHOULDER = 12;

  const nose = landmarks[NOSE];
  const leftEye = landmarks[LEFT_EYE];
  const rightEye = landmarks[RIGHT_EYE];
  const leftShoulder = landmarks[LEFT_SHOULDER];
  const rightShoulder = landmarks[RIGHT_SHOULDER];

  if (!nose || !leftShoulder || !rightShoulder) return;

  // worldLandmarksを使用（より正確な3D座標）
  const useWorldLandmarks = worldLandmarks && worldLandmarks.length > 0;
  const nose3D = useWorldLandmarks ? worldLandmarks[NOSE] : nose;
  const leftShoulder3D = useWorldLandmarks ? worldLandmarks[LEFT_SHOULDER] : leftShoulder;
  const rightShoulder3D = useWorldLandmarks ? worldLandmarks[RIGHT_SHOULDER] : rightShoulder;

  if (!nose3D || !leftShoulder3D || !rightShoulder3D) return;

  // 肩の中点を計算（3D座標を使用）
  const shoulderCenterX = (leftShoulder3D.x + rightShoulder3D.x) / 2;
  const shoulderCenterY = (leftShoulder3D.y + rightShoulder3D.y) / 2;
  const shoulderCenterZ = (leftShoulder3D.z + rightShoulder3D.z) / 2;

  // 頭の方向ベクトル（鼻から肩の中点へ）
  // MediaPipe座標系: X(左→右), Y(上→下), Z(奥→手前)
  // VRM座標系: X(右→左), Y(下→上), Z(奥→手前)
  // VRMシーンは180度回転しているため、X軸とZ軸を反転
  const headDirX = -(nose3D.x - shoulderCenterX); // X軸反転（VRM座標系に合わせる）
  const headDirY = -(nose3D.y - shoulderCenterY); // Y軸反転（MediaPipeは上→下、VRMは下→上）
  const headDirZ = nose3D.z - shoulderCenterZ; // Z軸はそのまま

  // ベクトルを正規化
  const length = Math.sqrt(headDirX * headDirX + headDirY * headDirY + headDirZ * headDirZ);
  if (length < 0.01) return;

  const normalizedX = headDirX / length;
  const normalizedY = headDirY / length;
  const normalizedZ = headDirZ / length;

  // 頭の回転を計算
  // Yaw（左右の回転）: X-Z平面での角度
  // Pitch（上下の回転）: Y-Z平面での角度
  // Roll（傾き）: 目の位置から計算
  const yaw = Math.atan2(normalizedX, normalizedZ);
  const pitch = Math.asin(-normalizedY);
  
  // ロール（左右の傾き）を目の位置から計算
  let roll = 0;
  if (leftEye && rightEye) {
    const eyeDiffY = leftEye.y - rightEye.y;
    const eyeDiffX = leftEye.x - rightEye.x;
    // MediaPipe座標系ではXが左→右なので、符号を反転
    roll = Math.atan2(eyeDiffY, -eyeDiffX);
  }

  // VRM座標系に合わせて回転を適用
  // VRMのheadボーンはY軸が上向き、Z軸が前向き
  // Euler角の順序: XYZ (pitch, yaw, roll)
  const head = humanoid.getNormalizedBoneNode('head');
  if (head) {
    // 座標系の変換: MediaPipeからVRMへ
    tempEuler.set(
      pitch,      // Pitch（上下）: そのまま
      -yaw,       // Yaw（左右）: 反転（VRM座標系に合わせる）
      roll        // Roll（傾き）: そのまま
    );
    tempQuaternion.setFromEuler(tempEuler);
    head.quaternion.slerp(tempQuaternion, SMOOTHING_FACTORS.head);
  }

  // 首のボーンにも軽く適用（頭の30%の動き）
  const neck = humanoid.getNormalizedBoneNode('neck');
  if (neck) {
    tempEuler.set(
      pitch * 0.3,  // 頭の30%
      -yaw * 0.3,   // 頭の30%、符号反転
      roll * 0.3    // 頭の30%
    );
    tempQuaternion.setFromEuler(tempEuler);
    neck.quaternion.slerp(tempQuaternion, SMOOTHING_FACTORS.neck);
  }
};

/**
 * Kalidokitを使用してポーズデータをVRMに適用する
 */
export const retargetPoseToVRMWithKalidokit = (
  vrm: VRM,
  landmarks: PoseLandmark[],
  worldLandmarks: PoseLandmark[] | null = null
): void => {
  if (!vrm.humanoid || landmarks.length === 0) {
    return;
  }

  try {
    // MediaPipeのランドマークをKalidokitの形式に変換
    const poseLandmarks = landmarks.map(landmark => ({
      x: landmark.x,
      y: landmark.y,
      z: landmark.z,
      visibility: landmark.visibility
    }));

    // worldLandmarksも変換（3D空間座標）
    const worldLandmarksFormatted = worldLandmarks
      ? worldLandmarks.map(landmark => ({
          x: landmark.x,
          y: landmark.y,
          z: landmark.z,
          visibility: landmark.visibility
        }))
      : poseLandmarks;

    // Kalidokitでポーズを解析
    // worldLandmarksを使用することで正確な3D回転を計算
    const riggedPose = Kalidokit.Pose.solve(poseLandmarks, worldLandmarksFormatted, {
      runtime: 'mediapipe',
      enableLegs: true
    });

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

    // 背骨（Spine）の回転 - 体の傾きを主に表現（回転を抑制）
    if (riggedPose.Spine) {
      const spine = humanoid.getNormalizedBoneNode('spine');
      if (spine) {
        // 回転を抑制（傾きのみを表現）
        const limitedSpineRotation = {
          x: (riggedPose.Spine.x || 0) * 0.7, // 30% → 70%に緩和（傾きを強く反映）
          y: (riggedPose.Spine.y || 0) * 0.1, // Y軸回転を10%に制限（最重要）
          z: (riggedPose.Spine.z || 0) * 0.7  // 30% → 70%に緩和
        };
        applySmoothRotation(spine, limitedSpineRotation, SMOOTHING_FACTORS.spine);
      }

      // 上部背骨（Chest）にも補助的な動きを追加（さらに制限）
      const chest = humanoid.getNormalizedBoneNode('chest');
      if (chest) {
        const chestRotation = {
          x: (riggedPose.Spine.x || 0) * 0.35, // 20% → 35%に緩和
          y: (riggedPose.Spine.y || 0) * 0.05, // Y軸回転を5%に制限
          z: (riggedPose.Spine.z || 0) * 0.35  // 20% → 35%に緩和
        };
        applySmoothRotation(chest, chestRotation, SMOOTHING_FACTORS.chest);
      }
    }

    // 頭（Head）の回転を適用
    // MediaPipeランドマークから直接計算（座標系の問題を修正済み）
    if (landmarks.length > 0) {
      applyHeadRotationFromLandmarks(humanoid, landmarks, worldLandmarks);
    }

    // 腕の動きを有効化（Y軸反転修正後）
    // 肩しか見えない場合でも、Kalidokitの推測を信頼して適用
    
    // 左腕
    if (riggedPose.LeftUpperArm) {
      const leftUpperArm = humanoid.getNormalizedBoneNode('leftUpperArm');
      if (leftUpperArm) {
        applySmoothRotation(leftUpperArm, riggedPose.LeftUpperArm, SMOOTHING_FACTORS.upperArm);
      }
    }

    if (riggedPose.LeftLowerArm) {
      const leftLowerArm = humanoid.getNormalizedBoneNode('leftLowerArm');
      if (leftLowerArm) {
        applySmoothRotation(leftLowerArm, riggedPose.LeftLowerArm, SMOOTHING_FACTORS.lowerArm);
      }
    }

    // 右腕
    if (riggedPose.RightUpperArm) {
      const rightUpperArm = humanoid.getNormalizedBoneNode('rightUpperArm');
      if (rightUpperArm) {
        applySmoothRotation(rightUpperArm, riggedPose.RightUpperArm, SMOOTHING_FACTORS.upperArm);
      }
    }

    if (riggedPose.RightLowerArm) {
      const rightLowerArm = humanoid.getNormalizedBoneNode('rightLowerArm');
      if (rightLowerArm) {
        applySmoothRotation(rightLowerArm, riggedPose.RightLowerArm, SMOOTHING_FACTORS.lowerArm);
      }
    }

    // 脚の動きは最小限に（ビデオ会議用 - 座位想定）
    // スムージングを非常に強くして急激な動きを抑制
    if (riggedPose.LeftUpperLeg) {
      const leftUpperLeg = humanoid.getNormalizedBoneNode('leftUpperLeg');
      if (leftUpperLeg) {
        applySmoothRotation(leftUpperLeg, riggedPose.LeftUpperLeg, SMOOTHING_FACTORS.upperLeg);
      }
    }

    if (riggedPose.LeftLowerLeg) {
      const leftLowerLeg = humanoid.getNormalizedBoneNode('leftLowerLeg');
      if (leftLowerLeg) {
        applySmoothRotation(leftLowerLeg, riggedPose.LeftLowerLeg, SMOOTHING_FACTORS.lowerLeg);
      }
    }

    if (riggedPose.RightUpperLeg) {
      const rightUpperLeg = humanoid.getNormalizedBoneNode('rightUpperLeg');
      if (rightUpperLeg) {
        applySmoothRotation(rightUpperLeg, riggedPose.RightUpperLeg, SMOOTHING_FACTORS.upperLeg);
      }
    }

    if (riggedPose.RightLowerLeg) {
      const rightLowerLeg = humanoid.getNormalizedBoneNode('rightLowerLeg');
      if (rightLowerLeg) {
        applySmoothRotation(rightLowerLeg, riggedPose.RightLowerLeg, SMOOTHING_FACTORS.lowerLeg);
      }
    }

  } catch (error) {
    // エラーハンドリングを強化
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Kalidokitでのリターゲッティングエラー:', {
      message: errorMessage,
      error,
      hasHumanoid: !!vrm.humanoid,
      landmarksLength: landmarks.length,
      hasWorldLandmarks: !!worldLandmarks
    });
  }
};

