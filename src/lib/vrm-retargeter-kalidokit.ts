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
 * MediaPipeランドマークから頭の回転を計算
 * より単純で安定した方法を使用
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

  // 肩の中点を計算
  const shoulderCenterX = (leftShoulder3D.x + rightShoulder3D.x) / 2;
  const shoulderCenterY = (leftShoulder3D.y + rightShoulder3D.y) / 2;
  const shoulderCenterZ = (leftShoulder3D.z + rightShoulder3D.z) / 2;

  // 頭の方向ベクトルを計算（鼻から肩の中点への方向）
  // MediaPipe座標系をVRM座標系に変換
  const headDirX = -(nose3D.x - shoulderCenterX); // X軸反転
  const headDirY = -(nose3D.y - shoulderCenterY); // Y軸反転
  const headDirZ = nose3D.z - shoulderCenterZ;    // Z軸そのまま

  // ベクトルを正規化
  const length = Math.sqrt(headDirX * headDirX + headDirY * headDirY + headDirZ * headDirZ);
  if (length < 0.01) return;

  const normalizedX = headDirX / length;
  const normalizedY = headDirY / length;
  const normalizedZ = headDirZ / length;

  // 頭の回転を計算（範囲を制限して不自然な角度を防ぐ）
  // Yaw（左右の回転）: 最大±45度に制限
  const yaw = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, Math.atan2(normalizedX, normalizedZ)));
  
  // Pitch（上下の回転）: 最大±30度に制限
  const pitch = Math.max(-Math.PI / 6, Math.min(Math.PI / 6, Math.asin(-normalizedY)));
  
  // Roll（傾き）: 目の位置から計算、最大±15度に制限
  let roll = 0;
  if (leftEye && rightEye) {
    const eyeDiffY = leftEye.y - rightEye.y;
    const eyeDiffX = leftEye.x - rightEye.x;
    const calculatedRoll = Math.atan2(eyeDiffY, -eyeDiffX);
    roll = Math.max(-Math.PI / 12, Math.min(Math.PI / 12, calculatedRoll));
  }

  // VRM座標系に合わせて回転を適用
  // Euler角の順序: XYZ (pitch, yaw, roll)
  const head = humanoid.getNormalizedBoneNode('head');
  if (head) {
    tempEuler.set(
      pitch,      // Pitch（上下）
      -yaw,       // Yaw（左右）: 反転
      roll        // Roll（傾き）
    );
    tempQuaternion.setFromEuler(tempEuler);
    // スムージングを強めにして、急激な動きを防ぐ
    head.quaternion.slerp(tempQuaternion, 0.2); // 0.3 → 0.2 に変更（より滑らかに）
  }

  // 首のボーンへの適用を大幅に減らす（頭の10%のみ）
  // 首が不自然に動くのを防ぐため
  const neck = humanoid.getNormalizedBoneNode('neck');
  if (neck) {
    tempEuler.set(
      pitch * 0.1,  // 頭の10%に減らす（30% → 10%）
      -yaw * 0.1,   // 頭の10%
      roll * 0.1    // 頭の10%
    );
    tempQuaternion.setFromEuler(tempEuler);
    neck.quaternion.slerp(tempQuaternion, 0.3);
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

    // デバッグ: riggedPoseの値を確認（開発環境のみ）
    const DEBUG_MODE = process.env.NODE_ENV === 'development' && 
      (typeof window !== 'undefined' && (window as any).__VRM_DEBUG__ === true);
    
    if (DEBUG_MODE && Math.random() < 0.05) { // 5%の確率でログ出力
      console.log('🎯 Kalidokit riggedPose:', {
        LeftUpperArm: riggedPose.LeftUpperArm ? {
          x: riggedPose.LeftUpperArm.x?.toFixed(2),
          y: riggedPose.LeftUpperArm.y?.toFixed(2),
          z: riggedPose.LeftUpperArm.z?.toFixed(2)
        } : null,
        RightUpperArm: riggedPose.RightUpperArm ? {
          x: riggedPose.RightUpperArm.x?.toFixed(2),
          y: riggedPose.RightUpperArm.y?.toFixed(2),
          z: riggedPose.RightUpperArm.z?.toFixed(2)
        } : null,
        Spine: riggedPose.Spine ? {
          x: riggedPose.Spine.x?.toFixed(2),
          y: riggedPose.Spine.y?.toFixed(2),
          z: riggedPose.Spine.z?.toFixed(2)
        } : null
      });
    }

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

