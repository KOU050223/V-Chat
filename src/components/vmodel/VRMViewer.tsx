'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { VRM, VRMLoaderPlugin } from '@pixiv/three-vrm';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, Download, Eye, EyeOff } from 'lucide-react';

import VRMDisplayManager from '@/lib/vrmDisplayManager';

interface VRMViewerProps {
  modelId?: string; // VRoidモデルID（推奨）
  vrmUrl?: string; // 直接URL（レガシー対応）
  vrmBlob?: Blob; // 直接Blob（レガシー対応）
  modelName?: string;
  className?: string;
  width?: number;
  height?: number;
  useCache?: boolean; // キャッシュ使用有無
  onLoadStart?: () => void;
  onLoadComplete?: (vrm: VRM) => void;
  onLoadError?: (error: Error) => void;
}

export default function VRMViewer({
  modelId,
  vrmUrl,
  vrmBlob,
  modelName = 'VRMモデル',
  className = '',
  width = 400,
  height = 400,
  useCache = true,
  onLoadStart,
  onLoadComplete,
  onLoadError
}: VRMViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const vrmRef = useRef<VRM | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  // VRMロード関数
  const loadVRM = async (url: string) => {
    if (!mountRef.current) return;

    try {
      setLoading(true);
      setError(null);
      onLoadStart?.();

      // GLTF Loader with VRM plugin
      const loader = new GLTFLoader();
      loader.register((parser) => {
        return new VRMLoaderPlugin(parser);
      });
      
      console.log('VRM読み込み開始:', url);
      const gltf = await loader.loadAsync(url);
      const vrm = gltf.userData.vrm as VRM;
      
      console.log('VRM読み込み完了:', vrm);

      // 既存のVRMを削除
      if (vrmRef.current) {
        sceneRef.current?.remove(vrmRef.current.scene);
        vrmRef.current.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry?.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach((material) => material?.dispose());
            } else {
              child.material?.dispose();
            }
          }
        });
      }

      // 新しいVRMをシーンに追加
      vrmRef.current = vrm;
      sceneRef.current?.add(vrm.scene);

      // VRMの位置調整
      vrm.scene.position.set(0, -1, 0);
      
      // VRMサイズの正規化
      const box = new THREE.Box3().setFromObject(vrm.scene);
      const size = box.getSize(new THREE.Vector3()).length();
      const scale = 2 / size;
      vrm.scene.scale.setScalar(scale);

      onLoadComplete?.(vrm);
      setLoading(false);

    } catch (error) {
      console.error('VRM読み込みエラー:', error);
      const errorMessage = error instanceof Error ? error.message : 'VRM読み込みに失敗しました';
      setError(errorMessage);
      onLoadError?.(error instanceof Error ? error : new Error(errorMessage));
      setLoading(false);
    }
  };

  // Three.js初期化
  useEffect(() => {
    if (!mountRef.current) return;

    // シーン作成
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    sceneRef.current = scene;

    // カメラ作成
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, 0, 3);
    cameraRef.current = camera;

    // レンダラー作成
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true 
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // ライト追加
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // OrbitControls追加
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.enableZoom = true;
    controls.autoRotate = false;
    controls.target.set(0, 0, 0);
    controls.update();

    // DOMに追加
    mountRef.current.appendChild(renderer.domElement);

    // アニメーションループ
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);

      const deltaTime = clockRef.current.getDelta();

      // VRMアニメーション更新
      if (vrmRef.current) {
        vrmRef.current.update(deltaTime);
      }

      // OrbitControls更新
      controls.update();

      renderer.render(scene, camera);
    };
    animate();

    // クリーンアップ関数
    return () => {
      if (animationIdRef.current !== null) {
        cancelAnimationFrame(animationIdRef.current);
      }
      
      if (vrmRef.current) {
        vrmRef.current.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry?.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach((material) => material?.dispose());
            } else {
              child.material?.dispose();
            }
          }
        });
      }
      
      renderer.dispose();
      
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [width, height]);

  // VRMファイル読み込み
  useEffect(() => {
    if (modelId) {
      // モデルIDから読み込み
      setLoading(true);
      setError(null);
      onLoadStart?.();

      const loadFromModelId = async () => {
        try {
          console.log('VRMDisplayManager import test - loading model:', modelId);
          // VRoid API経由でダウンロードライセンスを取得
          const licenseResponse = await fetch(`/api/vroid/download-license`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model_id: modelId })
          });

          if (!licenseResponse.ok) {
            throw new Error('Failed to get download license');
          }

          const licenseData = await licenseResponse.json();
          console.log('License data received:', licenseData);
          
          if (licenseData.success && licenseData.url) {
            if (licenseData.proxy) {
              // プロキシ経由の場合は直接Blobとしてfetchしてから読み込み
              console.log('Loading VRM via proxy:', licenseData.url);
              const vrmResponse = await fetch(licenseData.url);
              if (!vrmResponse.ok) {
                throw new Error(`Failed to fetch VRM file: ${vrmResponse.statusText}`);
              }
              const vrmBlob = await vrmResponse.blob();
              const objectUrl = URL.createObjectURL(vrmBlob);
              await loadVRM(objectUrl);
              // VRM読み込み完了後にURL解放（非同期処理完了を保証）
              setTimeout(() => {
                URL.revokeObjectURL(objectUrl);
              }, 0);
            } else {
              // 直接URLの場合
              console.log('Loading VRM directly:', licenseData.url);
              await loadVRM(licenseData.url);
            }
          } else {
            throw new Error('No download URL available');
          }
        } catch (error) {
          console.error('VRM modelId読み込みエラー:', error);
          const errorMessage = error instanceof Error ? error.message : 'モデルIDからのVRM読み込みに失敗しました';
          setError(errorMessage);
          onLoadError?.(error instanceof Error ? error : new Error(errorMessage));
          setLoading(false);
        }
      };

      loadFromModelId();
    } else if (vrmUrl) {
      loadVRM(vrmUrl);
    } else if (vrmBlob) {
      const objectUrl = URL.createObjectURL(vrmBlob);
      loadVRM(objectUrl).finally(() => {
        URL.revokeObjectURL(objectUrl);
      });
    }
  }, [modelId, vrmUrl, vrmBlob]);

  // 表示切り替え
  const toggleVisibility = () => {
    if (vrmRef.current) {
      vrmRef.current.scene.visible = !isVisible;
      setIsVisible(!isVisible);
    }
  };

  // リセット
  const resetPosition = () => {
    if (vrmRef.current) {
      vrmRef.current.scene.rotation.set(0, 0, 0);
      vrmRef.current.scene.position.set(0, -1, 0);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{modelName}</span>
          <div className="flex gap-2">
            {loading && <Badge variant="secondary">読み込み中...</Badge>}
            {error && <Badge variant="destructive">エラー</Badge>}
            {vrmRef.current && <Badge variant="default">表示中</Badge>}
          </div>
        </CardTitle>
        <CardDescription>
          3Dモデルビューア（Three.js + VRM）
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* 3Dビューア */}
          <div 
            ref={mountRef} 
            className="border rounded-md bg-gray-50 flex items-center justify-center"
            style={{ width, height }}
          >
            {loading && (
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">VRM読み込み中...</p>
              </div>
            )}
            {error && (
              <div className="text-center text-red-600">
                <p className="text-sm">{error}</p>
              </div>
            )}
          </div>

          {/* コントロール */}
          <div className="flex gap-2 flex-wrap">
            <Button 
              onClick={toggleVisibility} 
              variant="outline" 
              size="sm"
              disabled={!vrmRef.current}
            >
              {isVisible ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  非表示
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  表示
                </>
              )}
            </Button>
            
            <Button 
              onClick={resetPosition} 
              variant="outline" 
              size="sm"
              disabled={!vrmRef.current}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              リセット
            </Button>
          </div>

          {/* デバッグ情報 */}
          {vrmRef.current && (
            <div className="text-xs text-gray-500 space-y-1">
              <p>ポリゴン数: {vrmRef.current.scene.children.length}オブジェクト</p>
              <p>自動回転: 有効</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
