import { VRM } from '@pixiv/three-vrm';
import type { FaceBlendShapes } from '@/types/mediapipe';

// デバッグモード（環境変数で制御、デフォルトはfalse）
const DEBUG_MODE = process.env.NODE_ENV === 'development' && 
  (typeof window !== 'undefined' && (window as any).__VRM_DEBUG__ === true);

// BlendShape名のキャッシュ（一度見つかった名前を保存）
const blendShapeNameCache = new WeakMap<VRM, {
  blink?: string;
  mouthOpen?: string;
  smile?: string;
}>();

/**
 * BlendShapeProxyで利用可能な名前を検索し、キャッシュに保存
 * エラーハンドリングを強化
 */
const findBlendShapeName = (
  vrm: VRM,
  names: string[],
  cacheKey: 'blink' | 'mouthOpen' | 'smile'
): string | null => {
  const cache = blendShapeNameCache.get(vrm) || {};
  if (cache[cacheKey]) {
    return cache[cacheKey]!;
  }

  const blendShapeProxy = (vrm as any).blendShapeProxy;
  if (!blendShapeProxy) {
    if (DEBUG_MODE) {
      console.debug('BlendShapeProxyが利用できません');
    }
    return null;
  }

  // BlendShapeGroupsから利用可能な名前を取得（より確実な方法）
  let availableNames: string[] = [];
  try {
    if (blendShapeProxy.blendShapeGroups) {
      availableNames = blendShapeProxy.blendShapeGroups.map((group: any) => 
        group.name || group.preset
      ).filter(Boolean);
    }
  } catch (e) {
    if (DEBUG_MODE) {
      console.debug('BlendShapeGroupsの取得に失敗:', e);
    }
  }

  // まず、利用可能な名前リストから検索
  for (const name of names) {
    if (availableNames.length > 0 && !availableNames.includes(name)) {
      continue; // 利用可能な名前リストにない場合はスキップ
    }

    try {
      // 値を0に設定してテスト（エラーが発生しなければ名前が存在する）
      blendShapeProxy.setValue(name, 0);
      cache[cacheKey] = name;
      blendShapeNameCache.set(vrm, cache);
      if (DEBUG_MODE) {
        console.debug(`BlendShape名が見つかりました: ${name} (${cacheKey})`);
      }
      return name;
    } catch (e) {
      // 名前が存在しない場合は次の名前を試す
      if (DEBUG_MODE && names.indexOf(name) === names.length - 1) {
        console.debug(`BlendShape名の検索に失敗: ${cacheKey}`, e);
      }
      continue;
    }
  }

  // 全ての名前を試しても見つからなかった場合
  if (DEBUG_MODE) {
    console.warn(`BlendShape名が見つかりませんでした: ${cacheKey}`, {
      triedNames: names,
      availableNames: availableNames.length > 0 ? availableNames : 'unknown'
    });
  }
  return null;
};

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
  if (!vrm) {
    if (DEBUG_MODE) {
      console.error('VRMオブジェクトが無効です');
    }
    return;
  }

  const expressionManager = vrm.expressionManager;
  if (!expressionManager) {
    if (DEBUG_MODE) {
      console.warn('⚠️ expressionManager が存在しません', {
        vrmVersion: vrm.meta?.metaVersion,
        hasBlendShapeProxy: !!(vrm as any).blendShapeProxy
      });
    }
    return;
  }

  try {
    // デバッグモードでのみ詳細ログを出力
    if (DEBUG_MODE) {
      const presetNames = expressionManager.expressionMap ? 
        Object.keys(expressionManager.expressionMap) : [];
      if (presetNames.length === 0) {
        console.warn('⚠️ VRMモデルが表情BlendShapeに対応していません');
      }
    }

    // ExpressionManagerを優先的に使用（VRM標準の方法）
    // BlendShapeProxyはExpressionManagerで対応できない場合のみ使用
    
    // まばたき（最も重要）
    const blinkValue = (blendShapes.eyeBlinkLeft + blendShapes.eyeBlinkRight) / 2;
    const blinkLeftValue = Math.max(0, Math.min(1, blendShapes.eyeBlinkLeft));
    const blinkRightValue = Math.max(0, Math.min(1, blendShapes.eyeBlinkRight));
    
    // ExpressionManagerでまばたきを設定
    expressionManager.setValue('blink', blinkValue);
    expressionManager.setValue('blinkLeft', blinkLeftValue);
    expressionManager.setValue('blinkRight', blinkRightValue);
    
    // BlendShapeProxyで追加のまばたき設定（ExpressionManagerで対応できない場合）
    const blendShapeProxy = (vrm as any).blendShapeProxy;
    if (blendShapeProxy) {
      const blinkName = findBlendShapeName(vrm, ['blink', 'Blink', 'blinkLeft', 'Blink_L'], 'blink');
      if (blinkName) {
        blendShapeProxy.setValue(blinkName, blinkValue);
      }
    }

    // 口の開き（「あ」の形）
    const mouthOpenValue = Math.max(0, Math.min(1, blendShapes.mouthOpen * 2));
    expressionManager.setValue('aa', mouthOpenValue);
    
    // BlendShapeProxyで追加の口の開き設定
    if (blendShapeProxy) {
      const mouthName = findBlendShapeName(vrm, ['A', 'aa', 'a', 'mouthOpen', 'jawOpen'], 'mouthOpen');
      if (mouthName) {
        blendShapeProxy.setValue(mouthName, mouthOpenValue);
      }
    }

    // 笑顔
    const smileValue = Math.max(0, Math.min(1, blendShapes.mouthSmile * 1.5));
    expressionManager.setValue('happy', smileValue);
    
    // VRM 0.0互換性: 'happy'がない場合は'joy'を試す
    if (expressionManager.expressionMap && !expressionManager.expressionMap['happy']) {
      expressionManager.setValue('joy', smileValue);
    }
    
    // BlendShapeProxyで追加の笑顔設定
    if (blendShapeProxy) {
      const smileName = findBlendShapeName(vrm, ['Joy', 'joy', 'happy', 'Happy', 'smile', 'Smile'], 'smile');
      if (smileName) {
        blendShapeProxy.setValue(smileName, smileValue);
      }
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
      if ((vrm.lookAt as any).target) {
        (vrm.lookAt as any).target.set(
          lookX * 0.5,  // 左右の視線（-0.5 〜 0.5）
          lookY * 0.5,  // 上下の視線（-0.5 〜 0.5）
          1             // 前方1m
        );
      }
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
    // エラーログを適切に出力
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ VRM表情適用エラー:', {
      message: errorMessage,
      error,
      vrmVersion: vrm.meta?.metaVersion,
      hasExpressionManager: !!vrm.expressionManager
    });
    
    // デバッグモードではスタックトレースも出力
    if (DEBUG_MODE && error instanceof Error) {
      console.error('スタックトレース:', error.stack);
    }
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
    if (vrm.lookAt && (vrm.lookAt as any).target) {
      (vrm.lookAt as any).target.set(0, 0, 1);
    }
  } catch (error) {
    console.error('❌ VRM表情リセットエラー:', error);
  }
};

