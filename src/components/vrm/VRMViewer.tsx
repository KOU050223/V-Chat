import { useEffect, useRef, useState } from 'react';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils, VRMHumanBoneName } from '@pixiv/three-vrm';
import * as THREE from 'three';

interface VRMViewerProps {
  vrmUrl: string;
  onVRMLoaded?: (vrm: VRM) => void;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}

export const VRMViewer: React.FC<VRMViewerProps> = ({
  vrmUrl,
  onVRMLoaded,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1]
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [vrm, setVrm] = useState<VRM | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 直接GLTFLoaderを使用してVRMファイルを読み込み
  useEffect(() => {
    let isMounted = true; // クリーンアップ用フラグ

    const loadVRM = async () => {
      if (!isMounted) return; // アンマウント済みの場合は処理しない

      try {
        setError(null);
        setIsLoading(true);

        console.log('Starting VRM load from URL:', vrmUrl);

        // GLTFLoaderを作成
        const loader = new GLTFLoader();

        // VRMLoaderPluginを登録
        console.log('Registering VRMLoaderPlugin...');
        loader.register((parser) => {
          return new VRMLoaderPlugin(parser);
        });

        // VRMファイルを読み込み
        let lastProgressPercent = 0;
        const gltf = await new Promise<any>((resolve, reject) => {
          loader.load(
            vrmUrl,
            (gltf) => {
              console.log('GLTF loaded successfully');
              resolve(gltf);
            },
            (progress) => {
              // プログレス表示を10%刻みに制限
              if (progress.lengthComputable) {
                const percent = Math.floor((progress.loaded / progress.total) * 100);
                if (percent >= lastProgressPercent + 10) {
                  console.log(`VRM Loading: ${percent}% (${(progress.loaded / 1024 / 1024).toFixed(1)}MB / ${(progress.total / 1024 / 1024).toFixed(1)}MB)`);
                  lastProgressPercent = percent;
                }
              }
            },
            (error) => {
              console.error('GLTF loading error:', error);
              reject(error);
            }
          );
        });

        // VRM情報をログ出力（詳細は省略）
        console.log('VRM data loaded, checking for VRM instance...');

        // VRMLoaderPluginによって読み込まれたVRMを取得
        const vrmInstance = gltf.userData.vrm as VRM;

        if (!vrmInstance) {
          console.error('VRM instance not found in userData.vrm');
          console.log('Available userData keys:', Object.keys(gltf.userData));
          throw new Error(`VRMインスタンスの生成に失敗しました。userData.vrm が見つかりません。利用可能なキー: ${Object.keys(gltf.userData).join(', ')}`);
        }

        console.log('VRM instance found:', vrmInstance);

        // パフォーマンス最適化
        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        VRMUtils.combineSkeletons(gltf.scene);

        // VRMの初期設定
        vrmInstance.scene.traverse((child: any) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.frustumCulled = false;
          }
        });

        // VRMの初期ポーズを設定（Tポーズ）
        vrmInstance.humanoid?.resetNormalizedPose();

        // VRMアバターをカメラに向けて配置（180度回転でカメラ方向を向く）
        vrmInstance.scene.rotation.y = Math.PI;

        if (!isMounted) return; // レスポンス受信時にアンマウント済みの場合は処理しない

        setVrm(vrmInstance);
        setIsLoading(false);
        onVRMLoaded?.(vrmInstance);

        console.log('VRM successfully loaded and configured');

      } catch (err) {
        if (!isMounted) return; // エラー時にアンマウント済みの場合は処理しない

        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('VRM読み込みエラー:', errorMessage);

        // 循環参照を避けてエラー情報を安全に記録
        if (err instanceof Error) {
          console.error('Error details:', {
            name: err.name,
            message: err.message,
            stack: err.stack
          });
        }

        setError(`VRMの読み込みに失敗しました: ${errorMessage}`);
        setIsLoading(false);
      }
    };

    loadVRM();

    return () => {
      isMounted = false; // クリーンアップ時にフラグを設定
    };
  }, [vrmUrl, onVRMLoaded]);

  // エラーが発生した場合の表示
  if (error) {
    console.error('VRMエラー:', error);
    return (
      <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
        <mesh>
          <boxGeometry args={[1, 2, 0.5]} />
          <meshStandardMaterial color="red" />
        </mesh>
      </group>
    );
  }

  // VRMが読み込まれていない場合の表示
  if (!vrm) {
    return (
      <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
        <mesh>
          <boxGeometry args={[1, 2, 0.5]} />
          <meshStandardMaterial color={isLoading ? "yellow" : "gray"} />
        </mesh>
      </group>
    );
  }

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <primitive object={vrm.scene} />
    </group>
  );
};

