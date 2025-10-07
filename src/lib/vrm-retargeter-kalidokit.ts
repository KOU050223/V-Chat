/**
 * VRM Retargeter using Kalidokit
 * Kalidokitを使用してMediaPipeのランドマークをVRMに適用する
 */

import * as Kalidokit from 'kalidokit';
import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import type { PoseLandmark } from '../hooks/usePoseEstimation';

/**
 * 回転をスムーズに適用するヘルパー関数
 */
const applySmoothRotation = (
  bone: THREE.Object3D,
  targetRotation: { x: number; y: number; z: number },
  smoothing: number = 0.3
): void => {
  const targetEuler = new THREE.Euler(
    targetRotation.x || 0,
    targetRotation.y || 0,
    targetRotation.z || 0
  );
  const targetQuaternion = new THREE.Quaternion().setFromEuler(targetEuler);

  // Slerpを使って滑らかに補間
  bone.quaternion.slerp(targetQuaternion, smoothing);
};

/**
 * Kalidokitを使用してポーズデータをVRMに適用する
 */
export const retargetPoseToVRMWithKalidokit = (
  vrm: VRM,
  landmarks: PoseLandmark[]
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

    // Kalidokitでポーズを解析
    // 注意: KalidokitはworldLandmarksも必要とするが、MediaPipe Poseでは取得できないため
    // poseLandmarksを両方に使用する
    const riggedPose = Kalidokit.Pose.solve(poseLandmarks, poseLandmarks, {
      runtime: 'mediapipe',
      enableLegs: true
    });

    if (!riggedPose) {
      return;
    }

    const humanoid = vrm.humanoid;

    // デバッグログ（たまに出力）
    if (Math.random() < 0.01) {
      console.log('🎭 Kalidokitリグ結果:', {
        hips: riggedPose.Hips,
        spine: riggedPose.Spine,
        leftArm: riggedPose.LeftUpperArm,
        rightArm: riggedPose.RightUpperArm
      });
    }

    // 腰（Hips）の回転
    if (riggedPose.Hips) {
      const hips = humanoid.getNormalizedBoneNode('hips');
      if (hips) {
        applySmoothRotation(hips, riggedPose.Hips.rotation, 0.3);

        // 位置も設定（オプション）- 位置はスムージング弱め
        if (riggedPose.Hips.position) {
          hips.position.lerp(
            new THREE.Vector3(
              riggedPose.Hips.position.x || 0,
              riggedPose.Hips.position.y || 0,
              riggedPose.Hips.position.z || 0
            ),
            0.1
          );
        }
      }
    }

    // 背骨（Spine）の回転
    if (riggedPose.Spine) {
      const spine = humanoid.getNormalizedBoneNode('spine');
      if (spine) {
        applySmoothRotation(spine, riggedPose.Spine, 0.25);
      }
    }

    // 胸（Chest）の回転
    if (riggedPose.Chest) {
      const chest = humanoid.getNormalizedBoneNode('chest');
      if (chest) {
        applySmoothRotation(chest, riggedPose.Chest, 0.25);
      }
    }

    // 首（Neck）の回転
    if (riggedPose.Neck) {
      const neck = humanoid.getNormalizedBoneNode('neck');
      if (neck) {
        applySmoothRotation(neck, riggedPose.Neck, 0.3);
      }
    }

    // 頭（Head）の回転
    if (riggedPose.Head) {
      const head = humanoid.getNormalizedBoneNode('head');
      if (head) {
        applySmoothRotation(head, riggedPose.Head, 0.4);
      }
    }

    // 左腕
    if (riggedPose.LeftUpperArm) {
      const leftUpperArm = humanoid.getNormalizedBoneNode('leftUpperArm');
      if (leftUpperArm) {
        applySmoothRotation(leftUpperArm, riggedPose.LeftUpperArm, 0.3);
      }
    }

    if (riggedPose.LeftLowerArm) {
      const leftLowerArm = humanoid.getNormalizedBoneNode('leftLowerArm');
      if (leftLowerArm) {
        applySmoothRotation(leftLowerArm, riggedPose.LeftLowerArm, 0.3);
      }
    }

    // 右腕
    if (riggedPose.RightUpperArm) {
      const rightUpperArm = humanoid.getNormalizedBoneNode('rightUpperArm');
      if (rightUpperArm) {
        applySmoothRotation(rightUpperArm, riggedPose.RightUpperArm, 0.3);
      }
    }

    if (riggedPose.RightLowerArm) {
      const rightLowerArm = humanoid.getNormalizedBoneNode('rightLowerArm');
      if (rightLowerArm) {
        applySmoothRotation(rightLowerArm, riggedPose.RightLowerArm, 0.3);
      }
    }

    // 左脚
    if (riggedPose.LeftUpperLeg) {
      const leftUpperLeg = humanoid.getNormalizedBoneNode('leftUpperLeg');
      if (leftUpperLeg) {
        applySmoothRotation(leftUpperLeg, riggedPose.LeftUpperLeg, 0.3);
      }
    }

    if (riggedPose.LeftLowerLeg) {
      const leftLowerLeg = humanoid.getNormalizedBoneNode('leftLowerLeg');
      if (leftLowerLeg) {
        applySmoothRotation(leftLowerLeg, riggedPose.LeftLowerLeg, 0.3);
      }
    }

    // 右脚
    if (riggedPose.RightUpperLeg) {
      const rightUpperLeg = humanoid.getNormalizedBoneNode('rightUpperLeg');
      if (rightUpperLeg) {
        applySmoothRotation(rightUpperLeg, riggedPose.RightUpperLeg, 0.3);
      }
    }

    if (riggedPose.RightLowerLeg) {
      const rightLowerLeg = humanoid.getNormalizedBoneNode('rightLowerLeg');
      if (rightLowerLeg) {
        applySmoothRotation(rightLowerLeg, riggedPose.RightLowerLeg, 0.3);
      }
    }

  } catch (error) {
    console.error('❌ Kalidokitでのリターゲッティングエラー:', error);
  }
};
