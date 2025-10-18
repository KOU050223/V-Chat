/**
 * VRM Retargeter using Kalidokit
 * Kalidokitを使用してMediaPipeのランドマークをVRMに適用する
 */

import * as Kalidokit from 'kalidokit';
import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import type { PoseLandmark } from '../hooks/usePoseEstimation';

/**
 * オブジェクトプーリング用の再利用可能なオブジェクト
 * 毎フレームの新規オブジェクト生成を避けてガベージコレクション負荷を軽減
 */
const tempEuler = new THREE.Euler();
const tempQuaternion = new THREE.Quaternion();
const tempVector3 = new THREE.Vector3();

/**
 * 回転をスムーズに適用するヘルパー関数（最適化版）
 */
const applySmoothRotation = (
  bone: THREE.Object3D,
  targetRotation: { x: number; y: number; z: number },
  smoothing: number = 0.3 // 0.5 → 0.3 に戻して応答性向上
): void => {
  // 再利用可能なオブジェクトを使用（毎回新規作成しない）
  // VRMシーンの180度回転を考慮してY軸を反転
  tempEuler.set(
    targetRotation.x || 0,
    -(targetRotation.y || 0),  // Y軸反転（VRMシーンの180度回転を考慮）
    targetRotation.z || 0,
    'XYZ'
  );
  tempQuaternion.setFromEuler(tempEuler);

  // Slerpを使って滑らかに補間
  bone.quaternion.slerp(tempQuaternion, smoothing);
};

/**
 * MediaPipeランドマークから頭の回転を直接計算
 */
const applyHeadRotationFromLandmarks = (
  humanoid: any,
  landmarks: PoseLandmark[]
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

  // 肩の中点を計算
  const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
  const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;
  const shoulderCenterZ = (leftShoulder.z + rightShoulder.z) / 2;

  // 頭の方向ベクトル（鼻から肩の中点へ）
  const headDirX = nose.x - shoulderCenterX;
  const headDirY = -(nose.y - shoulderCenterY); // Y軸反転
  const headDirZ = nose.z - shoulderCenterZ;

  // ベクトルを正規化
  const length = Math.sqrt(headDirX * headDirX + headDirY * headDirY + headDirZ * headDirZ);
  if (length < 0.01) return;

  const normalizedX = headDirX / length;
  const normalizedY = headDirY / length;
  const normalizedZ = headDirZ / length;

  // 頭の回転を計算（簡易版）
  const yaw = Math.atan2(normalizedX, normalizedZ);
  const pitch = Math.asin(-normalizedY);

  // ロール（左右の傾き）を目の位置から計算
  let roll = 0;
  if (leftEye && rightEye) {
    const eyeDiffY = leftEye.y - rightEye.y;
    roll = Math.atan2(eyeDiffY, leftEye.x - rightEye.x);
  }

  // 頭のボーンに適用
  const head = humanoid.getNormalizedBoneNode('head');
  if (head) {
    tempEuler.set(pitch, yaw, roll);
    tempQuaternion.setFromEuler(tempEuler);
    head.quaternion.slerp(tempQuaternion, 0.5); // スムーズに適用
  }

  // 首のボーンにも軽く適用
  const neck = humanoid.getNormalizedBoneNode('neck');
  if (neck) {
    tempEuler.set(pitch * 0.3, yaw * 0.3, roll * 0.3); // 頭の30%
    tempQuaternion.setFromEuler(tempEuler);
    neck.quaternion.slerp(tempQuaternion, 0.5);
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

    // 背骨（Spine）の回転 - 体の傾きを主に表現
    if (riggedPose.Spine) {
      const spine = humanoid.getNormalizedBoneNode('spine');
      if (spine) {
        applySmoothRotation(spine, riggedPose.Spine, 0.25); // 0.3 → 0.25 より滑らかに
      }

      // 上部背骨（Chest）にも補助的な動きを追加
      const chest = humanoid.getNormalizedBoneNode('chest');
      if (chest) {
        const chestRotation = {
          x: (riggedPose.Spine.x || 0) * 0.5,
          y: (riggedPose.Spine.y || 0) * 0.5,
          z: (riggedPose.Spine.z || 0) * 0.5
        };
        applySmoothRotation(chest, chestRotation, 0.25);
      }
    }

    // 頭（Head）の回転を無効化（一時的）
    // VRMシーンの180度回転による座標系の問題を回避
    // TODO: 将来的に座標系を考慮した実装に置き換える
    /*
    if (landmarks.length > 0) {
      applyHeadRotationFromLandmarks(humanoid, landmarks);
    }
    */

    // Kalidokitが返すTPose型にはChest, Neck, Headがないため、手動実装は保留

    // 左腕（応答性と精度を向上）
    if (riggedPose.LeftUpperArm) {
      const leftUpperArm = humanoid.getNormalizedBoneNode('leftUpperArm');
      if (leftUpperArm) {
        applySmoothRotation(leftUpperArm, riggedPose.LeftUpperArm, 0.2); // 0.3 → 0.2
      }
    }

    if (riggedPose.LeftLowerArm) {
      const leftLowerArm = humanoid.getNormalizedBoneNode('leftLowerArm');
      if (leftLowerArm) {
        applySmoothRotation(leftLowerArm, riggedPose.LeftLowerArm, 0.2); // 0.3 → 0.2
      }
    }

    // 右腕（応答性と精度を向上）
    if (riggedPose.RightUpperArm) {
      const rightUpperArm = humanoid.getNormalizedBoneNode('rightUpperArm');
      if (rightUpperArm) {
        applySmoothRotation(rightUpperArm, riggedPose.RightUpperArm, 0.2); // 0.3 → 0.2
      }
    }

    if (riggedPose.RightLowerArm) {
      const rightLowerArm = humanoid.getNormalizedBoneNode('rightLowerArm');
      if (rightLowerArm) {
        applySmoothRotation(rightLowerArm, riggedPose.RightLowerArm, 0.2); // 0.3 → 0.2
      }
    }

    // 脚の動きは最小限に（ビデオ会議用 - 座位想定）
    // スムージングを非常に強くして急激な動きを抑制
    if (riggedPose.LeftUpperLeg) {
      const leftUpperLeg = humanoid.getNormalizedBoneNode('leftUpperLeg');
      if (leftUpperLeg) {
        applySmoothRotation(leftUpperLeg, riggedPose.LeftUpperLeg, 0.9); // 0.3 → 0.9 超安定化
      }
    }

    if (riggedPose.LeftLowerLeg) {
      const leftLowerLeg = humanoid.getNormalizedBoneNode('leftLowerLeg');
      if (leftLowerLeg) {
        applySmoothRotation(leftLowerLeg, riggedPose.LeftLowerLeg, 0.9); // 0.3 → 0.9
      }
    }

    if (riggedPose.RightUpperLeg) {
      const rightUpperLeg = humanoid.getNormalizedBoneNode('rightUpperLeg');
      if (rightUpperLeg) {
        applySmoothRotation(rightUpperLeg, riggedPose.RightUpperLeg, 0.9); // 0.3 → 0.9
      }
    }

    if (riggedPose.RightLowerLeg) {
      const rightLowerLeg = humanoid.getNormalizedBoneNode('rightLowerLeg');
      if (rightLowerLeg) {
        applySmoothRotation(rightLowerLeg, riggedPose.RightLowerLeg, 0.9); // 0.3 → 0.9
      }
    }

  } catch (error) {
    console.error('❌ Kalidokitでのリターゲッティングエラー:', error);
  }
};

