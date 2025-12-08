export interface AvatarMetadata {
  avatarUrl: string; // VRMファイルのURL
  avatarId?: string; // アバター識別子
  offset?: { x: number; y: number; z: number }; // アバターの表示位置補正（共有）
}

// 転送するボーンの回転情報（Quaternion）
// [x, y, z, w] の配列として軽量化
export type QuaternionArray = [number, number, number, number];

export interface BoneRotations {
  hips?: QuaternionArray;
  spine?: QuaternionArray;
  chest?: QuaternionArray;
  upperChest?: QuaternionArray;
  neck?: QuaternionArray;
  head?: QuaternionArray;
  leftShoulder?: QuaternionArray;
  leftUpperArm?: QuaternionArray;
  leftLowerArm?: QuaternionArray;
  leftHand?: QuaternionArray;
  rightShoulder?: QuaternionArray;
  rightUpperArm?: QuaternionArray;
  rightLowerArm?: QuaternionArray;
  rightHand?: QuaternionArray;
  leftUpperLeg?: QuaternionArray;
  leftLowerLeg?: QuaternionArray;
  leftFoot?: QuaternionArray;
  rightUpperLeg?: QuaternionArray;
  rightLowerLeg?: QuaternionArray;
  rightFoot?: QuaternionArray;
}

export interface MotionDataPacket {
  t: "m"; // type: motion
  b?: Record<string, number>; // Blendshapes (Face)
  r?: [number, number, number]; // Head Rotation (Legacy support / easy access)
  bones?: BoneRotations; // Upper body bone rotations
  v: 0 | 1; // Camera Active (1=ON, 0=OFF)
}
