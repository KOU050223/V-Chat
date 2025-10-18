import { VRM } from '@pixiv/three-vrm';
import { FaceBlendShapes } from '@/hooks/useFaceEstimation';

/**
 * MediaPipe Face BlendShapesをVRM Expressionにマッピング
 * 
 * VRM 1.0の標準Expression名:
 * - happy, angry, sad, relaxed, surprised (感情)
 * - aa, ih, ou, ee, oh (口の形 - あいうえお)
 * - blink, blinkLeft, blinkRight (まばたき)
 * - lookUp, lookDown, lookLeft, lookRight (視線)
 * - neutral (ニュートラル)
 */
export const applyFaceExpressionsToVRM = (
  vrm: VRM,
  blendShapes: FaceBlendShapes
): void => {
  const expressionManager = vrm.expressionManager;
  if (!expressionManager) {
    console.warn('⚠️ expressionManager が存在しません');
    return;
  }

  try {
    // デバッグ: BlendShape値とサポートされる表情を確認（50%の確率でログ - 頻度を上げる）
    if (Math.random() < 0.5) {
      console.log('📊 BlendShape値:', {
        eyeBlinkLeft: blendShapes.eyeBlinkLeft.toFixed(2),
        eyeBlinkRight: blendShapes.eyeBlinkRight.toFixed(2),
        mouthOpen: blendShapes.mouthOpen.toFixed(2),
        mouthSmile: blendShapes.mouthSmile.toFixed(2)
      });
      
      // 利用可能な表情名を確認
      const presetNames = expressionManager.expressionMap ? 
        Object.keys(expressionManager.expressionMap) : [];
      console.log('📝 VRMがサポートする表情:', presetNames);
      
      // 詳細情報も追加
      console.log('🔍 詳細デバッグ:', {
        hasExpressionManager: !!vrm.expressionManager,
        expressionMapKeys: vrm.expressionManager?.expressionMap ? Object.keys(vrm.expressionManager.expressionMap) : null,
        vrmVersion: vrm.meta?.metaVersion,
        allBlendShapes: blendShapes
      });

      // VRMのBlendShapeGroupも確認
      if (vrm.blendShapeProxy && vrm.blendShapeProxy.blendShapeGroups) {
        console.log('🎭 VRM BlendShapeGroups:', vrm.blendShapeProxy.blendShapeGroups.map(group => ({
          name: group.name,
          preset: group.preset,
          binds: group.binds?.length || 0
        })));
      }
    }

    // まばたき（最も重要）
    const blinkValue = (blendShapes.eyeBlinkLeft + blendShapes.eyeBlinkRight) / 2;
    
    // 方法1: ExpressionManagerを使用
    expressionManager.setValue('blink', blinkValue);
    
    // 方法2: BlendShapeProxyを直接使用（より確実）
    if (vrm.blendShapeProxy) {
      // VRM 1.0のBlendShapeProxyを使用
      const blinkLeftValue = Math.max(0, Math.min(1, blendShapes.eyeBlinkLeft));
      const blinkRightValue = Math.max(0, Math.min(1, blendShapes.eyeBlinkRight));
      
      // まばたきのBlendShapeを直接設定
      vrm.blendShapeProxy.setValue('blinkLeft', blinkLeftValue);
      vrm.blendShapeProxy.setValue('blinkRight', blinkRightValue);
      
      // 口の開き
      const mouthOpenValue = Math.max(0, Math.min(1, blendShapes.mouthOpen * 2));
      vrm.blendShapeProxy.setValue('A', mouthOpenValue); // VRM 0.0形式
      
      // 笑顔
      const smileValue = Math.max(0, Math.min(1, blendShapes.mouthSmile * 1.5));
      vrm.blendShapeProxy.setValue('Joy', smileValue); // VRM 0.0形式
    }
    
    // 左右個別のまばたき（モデルが対応している場合）
    expressionManager.setValue('blinkLeft', blendShapes.eyeBlinkLeft);
    expressionManager.setValue('blinkRight', blendShapes.eyeBlinkRight);

    // 口の開き（「あ」の形）
    // jawOpenは0-1の範囲で、0.3以上で口が開いていると判断
    const mouthOpenValue = Math.max(0, Math.min(1, blendShapes.mouthOpen * 2));
    expressionManager.setValue('aa', mouthOpenValue);

    // 笑顔
    // mouthSmileが0.5以上で笑顔と判断
    const smileValue = Math.max(0, Math.min(1, blendShapes.mouthSmile * 1.5));
    expressionManager.setValue('happy', smileValue);
    
    // VRM 0.0互換性: 'happy'がない場合は'joy'を試す
    if (expressionManager.expressionMap && !expressionManager.expressionMap['happy']) {
      expressionManager.setValue('joy', smileValue);
    }

    // 驚き（眉が上がる + 口が開く）
    const surprisedValue = Math.max(0, Math.min(1, 
      (blendShapes.browInnerUp * 0.7 + blendShapes.mouthOpen * 0.3)
    ));
    expressionManager.setValue('surprised', surprisedValue);
    
    // VRM 0.0互換性: 'surprised'がない場合は'fun'を試す
    if (expressionManager.expressionMap && !expressionManager.expressionMap['surprised']) {
      expressionManager.setValue('fun', surprisedValue);
    }

    // 口の形状の詳細（VRMが対応している場合）
    // VRM 1.0形式
    expressionManager.setValue('ih', blendShapes.mouthSmile * 0.5);
    expressionManager.setValue('ou', blendShapes.mouthPucker);
    expressionManager.setValue('oh', blendShapes.mouthFunnel);
    
    // VRM 0.0形式（互換性のため）
    if (expressionManager.expressionMap) {
      if (!expressionManager.expressionMap['ih']) {
        expressionManager.setValue('i', blendShapes.mouthSmile * 0.5);
      }
      if (!expressionManager.expressionMap['ou']) {
        expressionManager.setValue('u', blendShapes.mouthPucker);
      }
      if (!expressionManager.expressionMap['oh']) {
        expressionManager.setValue('o', blendShapes.mouthFunnel);
      }
    }

    // 視線の制御（VRM LookAt）
    if (vrm.lookAt && vrm.lookAt.target) {
      // 左右の目の視線を平均化
      const lookX = (
        (blendShapes.eyeLookOutLeft - blendShapes.eyeLookInLeft) +
        (blendShapes.eyeLookInRight - blendShapes.eyeLookOutRight)
      ) / 2;
      
      const lookY = (
        (blendShapes.eyeLookUpLeft - blendShapes.eyeLookDownLeft) +
        (blendShapes.eyeLookUpRight - blendShapes.eyeLookDownRight)
      ) / 2;

      // VRMのLookAtに適用（距離は1mに固定）
      vrm.lookAt.target.set(
        lookX * 0.5,  // 左右の視線（-0.5 〜 0.5）
        lookY * 0.5,  // 上下の視線（-0.5 〜 0.5）
        1             // 前方1m
      );
    }

    // 眉を下げる（怒りや悲しみの表現）
    const browDownValue = (blendShapes.browDownLeft + blendShapes.browDownRight) / 2;
    if (browDownValue > 0.3) {
      expressionManager.setValue('angry', browDownValue * 0.7);
      expressionManager.setValue('sad', browDownValue * 0.5);
    }

    // リラックス表情（全体的に力が抜けた状態）
    const relaxedValue = 1 - (blinkValue + smileValue + surprisedValue);
    if (relaxedValue > 0.5) {
      expressionManager.setValue('relaxed', Math.max(0, relaxedValue - 0.5) * 0.3);
    }

  } catch (error) {
    console.error('❌ VRM表情適用エラー:', error);
  }
};

/**
 * VRM表情をリセット（全ての表情を0に）
 */
export const resetVRMExpressions = (vrm: VRM): void => {
  const expressionManager = vrm.expressionManager;
  if (!expressionManager) {
    return;
  }

  try {
    // 全ての標準表情をリセット
    const expressions = [
      'happy', 'angry', 'sad', 'relaxed', 'surprised',
      'aa', 'ih', 'ou', 'ee', 'oh',
      'blink', 'blinkLeft', 'blinkRight',
      'lookUp', 'lookDown', 'lookLeft', 'lookRight',
      'neutral'
    ];

    expressions.forEach(name => {
      expressionManager.setValue(name, 0);
    });

    // LookAtもリセット（存在チェックを追加）
    if (vrm.lookAt && vrm.lookAt.target) {
      vrm.lookAt.target.set(0, 0, 1);
    }
  } catch (error) {
    console.error('❌ VRM表情リセットエラー:', error);
  }
};

