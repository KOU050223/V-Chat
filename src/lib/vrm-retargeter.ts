import { VRM, VRMHumanBoneName } from "@pixiv/three-vrm";
import * as THREE from "three";

interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

// MediaPipeのランドマークインデックス
export const POSE_LANDMARKS = {
  // 顔
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,

  // 上半身
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,

  // 下半身
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

/**
 * 2つのランドマークから方向ベクトルを計算
 */
const calculateDirectionVector = (
  landmarks: PoseLandmark[],
  fromIndex: number,
  toIndex: number
): THREE.Vector3 | null => {
  if (!landmarks[fromIndex] || !landmarks[toIndex]) {
    return null;
  }

  const from = landmarks[fromIndex];
  const to = landmarks[toIndex];

  // MediaPipeの座標系をVRM座標系に変換
  // 注意: VRMシーンはY軸周りに180度回転しているため、X軸とZ軸が反転する
  // MediaPipe: X(0→1: 左→右), Y(0→1: 上→下), Z(負→正: 奥→手前)
  // VRM(回転後): X(負→正: 右→左), Y(負→正: 下→上), Z(負→正: 奥→手前)
  return new THREE.Vector3(
    to.x - from.x, // シーン回転により、そのまま使用（左右は反転済み）
    -(to.y - from.y), // MediaPipeの上下を反転（下が正→上が正）
    -(to.z - from.z) // シーン回転により、Z軸も反転
  ).normalize();
};

/**
 * 基準ベクトルから目標ベクトルへの回転クォータニオンを計算
 */
const calculateRotationQuaternion = (
  baseVector: THREE.Vector3,
  targetVector: THREE.Vector3,
  smoothing: number = 0.5
): THREE.Quaternion => {
  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(baseVector, targetVector);

  // より軽いスムージングを適用（値を大きくして安定化）
  const identity = new THREE.Quaternion();
  quaternion.slerp(identity, 1 - smoothing);

  return quaternion;
};

/**
 * 上半身のボーンに回転を適用
 */
const applyUpperBodyRotations = (vrm: VRM, landmarks: PoseLandmark[]) => {
  const humanoid = vrm.humanoid;
  if (!humanoid) {
    console.warn("⚠️ VRM humanoidが見つかりません");
    return;
  }

  // 肩の回転を計算
  const leftShoulderDirection = calculateDirectionVector(
    landmarks,
    POSE_LANDMARKS.LEFT_SHOULDER,
    POSE_LANDMARKS.LEFT_ELBOW
  );

  const rightShoulderDirection = calculateDirectionVector(
    landmarks,
    POSE_LANDMARKS.RIGHT_SHOULDER,
    POSE_LANDMARKS.RIGHT_ELBOW
  );

  // デバッグログ（稀に出力）
  if (Math.random() < 0.01) {
    console.log("🦾 肩の方向ベクトル:", {
      left: leftShoulderDirection?.toArray(),
      right: rightShoulderDirection?.toArray(),
    });
  }

  // 左上腕の回転
  if (leftShoulderDirection) {
    const leftUpperArm = humanoid.getRawBoneNode(VRMHumanBoneName.LeftUpperArm);
    if (leftUpperArm) {
      // VRM Tポーズでの左腕の方向（横向き、やや下向き）
      // ローカル座標系: 左腕は-X方向（左向き）
      const baseVector = new THREE.Vector3(-1, -0.3, 0).normalize();
      const rotation = calculateRotationQuaternion(
        baseVector,
        leftShoulderDirection,
        0.5
      );

      // スムーズな補間で適用
      leftUpperArm.quaternion.slerp(rotation, 0.3);

      if (Math.random() < 0.01) {
        console.log("🦾 左腕回転適用:", {
          direction: leftShoulderDirection.toArray(),
          rotation: rotation.toArray(),
        });
      }
    } else {
      if (Math.random() < 0.01) {
        console.warn("⚠️ 左上腕のボーンが見つかりません");
      }
    }
  }

  // 右上腕の回転
  if (rightShoulderDirection) {
    const rightUpperArm = humanoid.getRawBoneNode(
      VRMHumanBoneName.RightUpperArm
    );
    if (rightUpperArm) {
      // VRM Tポーズでの右腕の方向（横向き、やや下向き）
      // ローカル座標系: 右腕は+X方向（右向き）
      const baseVector = new THREE.Vector3(1, -0.3, 0).normalize();
      const rotation = calculateRotationQuaternion(
        baseVector,
        rightShoulderDirection,
        0.5
      );

      // スムーズな補間で適用
      rightUpperArm.quaternion.slerp(rotation, 0.3);

      if (Math.random() < 0.01) {
        console.log("🦾 右腕回転適用:", {
          direction: rightShoulderDirection.toArray(),
          rotation: rotation.toArray(),
        });
      }
    } else {
      if (Math.random() < 0.01) {
        console.warn("⚠️ 右上腕のボーンが見つかりません");
      }
    }
  }

  // 前腕の回転を計算
  const leftForearmDirection = calculateDirectionVector(
    landmarks,
    POSE_LANDMARKS.LEFT_ELBOW,
    POSE_LANDMARKS.LEFT_WRIST
  );

  const rightForearmDirection = calculateDirectionVector(
    landmarks,
    POSE_LANDMARKS.RIGHT_ELBOW,
    POSE_LANDMARKS.RIGHT_WRIST
  );

  // 前腕の回転（軽量化のため一旦コメントアウト）
  /*
  if (leftForearmDirection) {
    const leftLowerArm = humanoid.getRawBoneNode(VRMHumanBoneName.LeftLowerArm);
    if (leftLowerArm) {
      const baseVector = new THREE.Vector3(-1, 0, 0);
      const rotation = calculateRotationQuaternion(baseVector, leftForearmDirection, 0.5);
      leftLowerArm.quaternion.slerp(rotation, 0.3);
    }
  }

  if (rightForearmDirection) {
    const rightLowerArm = humanoid.getRawBoneNode(VRMHumanBoneName.RightLowerArm);
    if (rightLowerArm) {
      const baseVector = new THREE.Vector3(1, 0, 0);
      const rotation = calculateRotationQuaternion(baseVector, rightForearmDirection, 0.5);
      rightLowerArm.quaternion.slerp(rotation, 0.3);
    }
  }
  */
};

/**
 * 頭の回転を適用
 */
const applyHeadRotation = (vrm: VRM, landmarks: PoseLandmark[]) => {
  const humanoid = vrm.humanoid;
  if (!humanoid) return;

  // 顔の向きを計算（鼻と肩の中点から）
  const nose = landmarks[POSE_LANDMARKS.NOSE];
  const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
  const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];

  if (!nose || !leftShoulder || !rightShoulder) return;

  // 肩の中点を計算
  const shoulderCenter = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
    z: (leftShoulder.z + rightShoulder.z) / 2,
  };

  // 頭の方向ベクトルを計算（VRM座標系に合わせて調整）
  const headDirection = new THREE.Vector3(
    -(nose.x - shoulderCenter.x), // X軸反転
    -(nose.y - shoulderCenter.y), // Y軸反転
    nose.z - shoulderCenter.z // Z軸そのまま
  ).normalize();

  const head = humanoid.getRawBoneNode(VRMHumanBoneName.Head);
  if (head) {
    const baseVector = new THREE.Vector3(0, 1, 0); // 頭の基準方向（上向き）
    const rotation = calculateRotationQuaternion(
      baseVector,
      headDirection,
      0.3
    );
    head.quaternion.slerp(rotation, 0.4); // より反応を良くする
  }
};

/**
 * 胴体の回転を適用
 */
const applySpineRotation = (vrm: VRM, landmarks: PoseLandmark[]) => {
  const humanoid = vrm.humanoid;
  if (!humanoid) return;

  const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
  const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
  const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
  const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];

  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return;

  // 肩と腰の中点を計算
  const shoulderCenter = new THREE.Vector3(
    (leftShoulder.x + rightShoulder.x) / 2,
    -(leftShoulder.y + rightShoulder.y) / 2,
    (leftShoulder.z + rightShoulder.z) / 2
  );

  const hipCenter = new THREE.Vector3(
    (leftHip.x + rightHip.x) / 2,
    -(leftHip.y + rightHip.y) / 2,
    (leftHip.z + rightHip.z) / 2
  );

  // 胴体の方向ベクトルを計算
  const spineDirection = new THREE.Vector3()
    .subVectors(shoulderCenter, hipCenter)
    .normalize();

  const spine = humanoid.getRawBoneNode(VRMHumanBoneName.Spine);
  if (spine) {
    const baseVector = new THREE.Vector3(0, 1, 0); // 胴体の基準方向（上向き）
    const rotation = calculateRotationQuaternion(
      baseVector,
      spineDirection,
      0.2
    );
    spine.quaternion.slerp(rotation, 0.3); // より反応を良くする
  }
};

/**
 * MediaPipeのポーズランドマークをVRMモデルに適用
 */
export const retargetPoseToVRM = (
  vrm: VRM,
  landmarks: PoseLandmark[]
): void => {
  if (!vrm || !landmarks || landmarks.length === 0) {
    console.warn("⚠️ VRMまたはランドマークが無効:", {
      vrm: !!vrm,
      landmarksLength: landmarks?.length,
    });
    return;
  }

  // 信頼度が低いランドマークをフィルタリング（閾値を下げて検出しやすく）
  const validLandmarks = landmarks.filter(
    (landmark) => landmark.visibility === undefined || landmark.visibility > 0.5
  );

  if (validLandmarks.length < landmarks.length * 0.3) {
    // 有効なランドマークが30%未満の場合は処理をスキップ
    if (Math.random() < 0.01) {
      // ログの頻度を下げる
      console.warn("⚠️ 有効なランドマークが不足:", {
        valid: validLandmarks.length,
        total: landmarks.length,
        threshold: landmarks.length * 0.3,
      });
    }
    return;
  }

  try {
    // 上半身、頭、胴体の回転を適用
    applyUpperBodyRotations(vrm, landmarks);
    applyHeadRotation(vrm, landmarks);
    applySpineRotation(vrm, landmarks);
  } catch (error) {
    console.error("リターゲティングエラー:", error);
  }
};

/**
 * VRMモデルを初期ポーズにリセット
 */
export const resetVRMPose = (vrm: VRM): void => {
  if (!vrm || !vrm.humanoid) return;

  try {
    vrm.humanoid.resetNormalizedPose();
  } catch (error) {
    console.error("VRMポーズリセットエラー:", error);
  }
};
