/**
 * VRM Retargeter using Kalidokit
 * Kalidokitを使用してMediaPipeのランドマークをVRMに適用する
 */

import * as Kalidokit from 'kalidokit';
import type { VRM } from '@pixiv/three-vrm';
import type { PoseLandmark } from '../hooks/usePoseEstimation';

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
        hips.rotation.set(
          riggedPose.Hips.rotation.x || 0,
          riggedPose.Hips.rotation.y || 0,
          riggedPose.Hips.rotation.z || 0
        );

        // 位置も設定（オプション）
        if (riggedPose.Hips.position) {
          hips.position.set(
            riggedPose.Hips.position.x || 0,
            riggedPose.Hips.position.y || 0,
            riggedPose.Hips.position.z || 0
          );
        }
      }
    }

    // 背骨（Spine）の回転
    if (riggedPose.Spine) {
      const spine = humanoid.getNormalizedBoneNode('spine');
      if (spine) {
        spine.rotation.set(
          riggedPose.Spine.x || 0,
          riggedPose.Spine.y || 0,
          riggedPose.Spine.z || 0
        );
      }
    }

    // 胸（Chest）の回転
    if (riggedPose.Chest) {
      const chest = humanoid.getNormalizedBoneNode('chest');
      if (chest) {
        chest.rotation.set(
          riggedPose.Chest.x || 0,
          riggedPose.Chest.y || 0,
          riggedPose.Chest.z || 0
        );
      }
    }

    // 首（Neck）の回転
    if (riggedPose.Neck) {
      const neck = humanoid.getNormalizedBoneNode('neck');
      if (neck) {
        neck.rotation.set(
          riggedPose.Neck.x || 0,
          riggedPose.Neck.y || 0,
          riggedPose.Neck.z || 0
        );
      }
    }

    // 頭（Head）の回転
    if (riggedPose.Head) {
      const head = humanoid.getNormalizedBoneNode('head');
      if (head) {
        head.rotation.set(
          riggedPose.Head.x || 0,
          riggedPose.Head.y || 0,
          riggedPose.Head.z || 0
        );
      }
    }

    // 左腕
    if (riggedPose.LeftUpperArm) {
      const leftUpperArm = humanoid.getNormalizedBoneNode('leftUpperArm');
      if (leftUpperArm) {
        leftUpperArm.rotation.set(
          riggedPose.LeftUpperArm.x || 0,
          riggedPose.LeftUpperArm.y || 0,
          riggedPose.LeftUpperArm.z || 0
        );
      }
    }

    if (riggedPose.LeftLowerArm) {
      const leftLowerArm = humanoid.getNormalizedBoneNode('leftLowerArm');
      if (leftLowerArm) {
        leftLowerArm.rotation.set(
          riggedPose.LeftLowerArm.x || 0,
          riggedPose.LeftLowerArm.y || 0,
          riggedPose.LeftLowerArm.z || 0
        );
      }
    }

    // 右腕
    if (riggedPose.RightUpperArm) {
      const rightUpperArm = humanoid.getNormalizedBoneNode('rightUpperArm');
      if (rightUpperArm) {
        rightUpperArm.rotation.set(
          riggedPose.RightUpperArm.x || 0,
          riggedPose.RightUpperArm.y || 0,
          riggedPose.RightUpperArm.z || 0
        );
      }
    }

    if (riggedPose.RightLowerArm) {
      const rightLowerArm = humanoid.getNormalizedBoneNode('rightLowerArm');
      if (rightLowerArm) {
        rightLowerArm.rotation.set(
          riggedPose.RightLowerArm.x || 0,
          riggedPose.RightLowerArm.y || 0,
          riggedPose.RightLowerArm.z || 0
        );
      }
    }

    // 左脚
    if (riggedPose.LeftUpperLeg) {
      const leftUpperLeg = humanoid.getNormalizedBoneNode('leftUpperLeg');
      if (leftUpperLeg) {
        leftUpperLeg.rotation.set(
          riggedPose.LeftUpperLeg.x || 0,
          riggedPose.LeftUpperLeg.y || 0,
          riggedPose.LeftUpperLeg.z || 0
        );
      }
    }

    if (riggedPose.LeftLowerLeg) {
      const leftLowerLeg = humanoid.getNormalizedBoneNode('leftLowerLeg');
      if (leftLowerLeg) {
        leftLowerLeg.rotation.set(
          riggedPose.LeftLowerLeg.x || 0,
          riggedPose.LeftLowerLeg.y || 0,
          riggedPose.LeftLowerLeg.z || 0
        );
      }
    }

    // 右脚
    if (riggedPose.RightUpperLeg) {
      const rightUpperLeg = humanoid.getNormalizedBoneNode('rightUpperLeg');
      if (rightUpperLeg) {
        rightUpperLeg.rotation.set(
          riggedPose.RightUpperLeg.x || 0,
          riggedPose.RightUpperLeg.y || 0,
          riggedPose.RightUpperLeg.z || 0
        );
      }
    }

    if (riggedPose.RightLowerLeg) {
      const rightLowerLeg = humanoid.getNormalizedBoneNode('rightLowerLeg');
      if (rightLowerLeg) {
        rightLowerLeg.rotation.set(
          riggedPose.RightLowerLeg.x || 0,
          riggedPose.RightLowerLeg.y || 0,
          riggedPose.RightLowerLeg.z || 0
        );
      }
    }

  } catch (error) {
    console.error('❌ Kalidokitでのリターゲッティングエラー:', error);
  }
};
