/**
 * MediaPipe関連の型定義
 * 共通の型定義をここに集約
 */

export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface FaceLandmark {
  x: number;
  y: number;
  z: number;
}

export interface FaceBlendShapes {
  // 目
  eyeBlinkLeft: number;      // 左目の閉じ具合 (0-1)
  eyeBlinkRight: number;     // 右目の閉じ具合 (0-1)
  eyeLookUpLeft: number;     // 左目の上向き
  eyeLookUpRight: number;    // 右目の上向き
  eyeLookDownLeft: number;   // 左目の下向き
  eyeLookDownRight: number;  // 右目の下向き
  eyeLookInLeft: number;     // 左目の内向き
  eyeLookInRight: number;    // 右目の内向き
  eyeLookOutLeft: number;    // 左目の外向き
  eyeLookOutRight: number;   // 右目の外向き
  
  // 口
  mouthOpen: number;         // 口の開き具合 (0-1)
  mouthSmile: number;        // 笑顔 (0-1)
  mouthPucker: number;      // 口をすぼめる
  mouthFunnel: number;       // 口を丸める
  
  // 眉
  browInnerUp: number;       // 眉の上げ具合 (0-1)
  browOuterUpLeft: number;   // 左眉の外側の上げ具合
  browOuterUpRight: number;  // 右眉の外側の上げ具合
  browDownLeft: number;      // 左眉を下げる
  browDownRight: number;    // 右眉を下げる
  
  // その他
  jawOpen: number;           // 顎の開き
  cheekPuff: number;         // 頬を膨らませる
}

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

