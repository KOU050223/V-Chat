export interface AvatarMetadata {
  avatarUrl: string; // VRMファイルのURL
  avatarId?: string; // アバターID
  offset?: { x: number; y: number; z: number }; // アバターの位置オフセット（共有）
  scale?: number; // アバターのスケール（デフォルト: 1.0）
  name?: string; // ユーザーの表示名
}

// 転送されるボーン回転データ（クォータニオン）
// 軽量化のため [x, y, z, w] の配列形式を使用
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
  t: "m"; // タイプ: モーション
  b?: Record<string, number>; // ブレンドシェイプ（表情）
  r?: [number, number, number]; // 頭部の回転（レガシーサポート/簡易アクセス用）
  bones?: BoneRotations; // 上半身のボーン回転
  v: 0 | 1; // カメラアクティブ状態（1=ON, 0=OFF）
}
