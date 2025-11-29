/**
 * VRM Hand Retargeter
 * MediaPipe Hand LandmarkerのランドマークをVRMの手の動きに適用する
 */

import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import type { HandLandmark } from '@/types/mediapipe';

// MediaPipe Hand Landmarkerのランドマークインデックス
const HAND_LANDMARKS = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_FINGER_MCP: 5,
  INDEX_FINGER_PIP: 6,
  INDEX_FINGER_DIP: 7,
  INDEX_FINGER_TIP: 8,
  MIDDLE_FINGER_MCP: 9,
  MIDDLE_FINGER_PIP: 10,
  MIDDLE_FINGER_DIP: 11,
  MIDDLE_FINGER_TIP: 12,
  RING_FINGER_MCP: 13,
  RING_FINGER_PIP: 14,
  RING_FINGER_DIP: 15,
  RING_FINGER_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20
} as const;

// 再利用可能なオブジェクト
const tempVector3 = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();
const tempEuler = new THREE.Euler();

/**
 * 2つのランドマークから方向ベクトルを計算
 */
const calculateDirection = (
  landmarks: HandLandmark[],
  fromIndex: number,
  toIndex: number
): THREE.Vector3 | null => {
  if (!landmarks[fromIndex] || !landmarks[toIndex]) {
    return null;
  }

  const from = landmarks[fromIndex];
  const to = landmarks[toIndex];

  // MediaPipe座標系をVRM座標系に変換
  return tempVector3.set(
    -(to.x - from.x), // X軸反転
    -(to.y - from.y), // Y軸反転
    to.z - from.z     // Z軸そのまま
  ).normalize();
};

/**
 * 手首から指の方向を計算して、手首の回転を適用
 */
const applyHandRotation = (
  humanoid: any,
  handSide: 'left' | 'right',
  landmarks: HandLandmark[]
): void => {
  if (!landmarks || landmarks.length < 5) return;

  const wrist = landmarks[HAND_LANDMARKS.WRIST];
  const middleFingerMCP = landmarks[HAND_LANDMARKS.MIDDLE_FINGER_MCP];

  if (!wrist || !middleFingerMCP) return;

  // 手首から中指の付け根への方向ベクトル
  const handDirection = calculateDirection(landmarks, HAND_LANDMARKS.WRIST, HAND_LANDMARKS.MIDDLE_FINGER_MCP);
  if (!handDirection) return;

  // 手首のボーン名を取得
  const handBoneName = handSide === 'left' ? 'leftHand' : 'rightHand';
  const handBone = humanoid.getNormalizedBoneNode(handBoneName);
  
  if (!handBone) return;

  // 基準方向（手首から前方向）
  const baseDirection = new THREE.Vector3(0, 0, 1);
  
  // 回転クォータニオンを計算
  tempQuaternion.setFromUnitVectors(baseDirection, handDirection);
  
  // スムーズに適用（手は中高反応性）
  const HAND_SMOOTHING = 0.2;
  handBone.quaternion.slerp(tempQuaternion, HAND_SMOOTHING);
};

/**
 * MediaPipe Hand LandmarkerのランドマークをVRMに適用
 */
export const retargetHandsToVRM = (
  vrm: VRM,
  leftHandLandmarks: HandLandmark[] | null,
  rightHandLandmarks: HandLandmark[] | null
): void => {
  if (!vrm.humanoid) {
    return;
  }

  try {
    // 左手の動きを適用
    if (leftHandLandmarks && leftHandLandmarks.length > 0) {
      applyHandRotation(vrm.humanoid, 'left', leftHandLandmarks);
    }

    // 右手の動きを適用
    if (rightHandLandmarks && rightHandLandmarks.length > 0) {
      applyHandRotation(vrm.humanoid, 'right', rightHandLandmarks);
    }
  } catch (error) {
    // エラーハンドリングを強化（手の検出が不安定な場合があるため、本番環境では静かに無視）
    const DEBUG_MODE = process.env.NODE_ENV === 'development';
    if (DEBUG_MODE) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ VRM手の動き適用エラー:', {
        message: errorMessage,
        error,
        hasHumanoid: !!vrm.humanoid,
        hasLeftHand: !!leftHandLandmarks,
        hasRightHand: !!rightHandLandmarks
      });
    }
  }
};

