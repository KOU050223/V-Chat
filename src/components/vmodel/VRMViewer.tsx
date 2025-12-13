"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { VRM, VRMLoaderPlugin } from "@pixiv/three-vrm";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import {
  RotateCcw,
  Download,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

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
  modelName = "VRMモデル",
  className = "",
  width = 400,
  height = 400,
  useCache = true,
  onLoadStart,
  onLoadComplete,
  onLoadError,
}: VRMViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const vrmRef = useRef<VRM | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());

  // 初期位置・スケールを保存するためのRef
  const initialTransformRef = useRef<{
    position: THREE.Vector3;
    scale: THREE.Vector3;
  } | null>(null);

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

      console.log("VRM読み込み開始:", url);
      const gltf = await loader.loadAsync(url);
      const vrm = gltf.userData.vrm as VRM;

      console.log("VRM読み込み完了:", vrm);

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

      // バウンディングボックスを計算して位置とサイズを調整
      // まず変換をリセット
      vrm.scene.position.set(0, 0, 0);
      vrm.scene.rotation.set(0, 0, 0);
      vrm.scene.scale.set(1, 1, 1);
      vrm.scene.updateMatrixWorld(true);

      const box = new THREE.Box3();
      let hasMeshes = false;

      vrm.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.visible) {
            box.expandByObject(child);
            hasMeshes = true;
          }
        }
      });

      if (!hasMeshes) {
        box.setFromObject(vrm.scene);
      }

      const boxCenter = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      // Hips（腰）の位置を取得して、水平方向(X, Z)の中心とする
      // バウンディングボックスだと、長い髪やスカート、装備品などで中心がずれることがあるため
      const hips = vrm.humanoid.getNormalizedBoneNode("hips");
      const targetCenter = boxCenter.clone();

      if (hips) {
        const hipsPos = hips.getWorldPosition(new THREE.Vector3());
        targetCenter.x = hipsPos.x;
        targetCenter.z = hipsPos.z;
        // Y軸（高さ）はバウンディングボックスの中心を使う（全身を収めるため）
      }

      console.log("Centering Target:", {
        boxCenter,
        hipsPos: hips?.getWorldPosition(new THREE.Vector3()),
        targetCenter,
      });

      // 画面に収まるようにスケール調整
      const maxSize = Math.max(size.x, size.y, size.z);
      const scale = 3.5 / maxSize; // 少し小さめにして余裕を持たせる
      vrm.scene.scale.setScalar(scale);

      // 中心を原点に移動 (スケーリングを考慮)
      // T = -S * C
      const centerPosition = targetCenter.clone().multiplyScalar(-scale);
      vrm.scene.position.copy(centerPosition);

      // 初期変換を保存
      initialTransformRef.current = {
        position: centerPosition.clone(),
        scale: new THREE.Vector3(scale, scale, scale),
      };

      onLoadComplete?.(vrm);
      setLoading(false);
    } catch (error) {
      console.error("VRM読み込みエラー:", error);
      const errorMessage =
        error instanceof Error ? error.message : "VRM読み込みに失敗しました";
      setError(errorMessage);
      onLoadError?.(error instanceof Error ? error : new Error(errorMessage));
      setLoading(false);
    }
  };

  // Three.js初期化
  useEffect(
    () => {
      // ... (既存の初期化コードは変更なし)
      if (!mountRef.current) return;

      // シーン作成
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf0f0f0);
      sceneRef.current = scene;

      // カメラ作成
      const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      camera.position.set(0, 1.0, 4.0);
      cameraRef.current = camera;

      // レンダラー作成
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
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
      controls.target.set(0, 0, 0); // ターゲットは原点
      controls.update();
      controlsRef.current = controls;

      // キャンバスのスタイルを強制的に設定（親コンテナいっぱいに広げる）
      renderer.domElement.style.position = "absolute";
      renderer.domElement.style.top = "0";
      renderer.domElement.style.left = "0";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";

      // DOMに追加
      mountRef.current.appendChild(renderer.domElement);

      // ResizeObserver setup
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height, false); // styleは変更しない(100%のまま)
          }
        }
      });
      resizeObserver.observe(mountRef.current);

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
        resizeObserver.disconnect();
        if (animationIdRef.current !== null) {
          cancelAnimationFrame(animationIdRef.current);
        }

        // ... existing cleanup ...
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
    },
    [
      /* width, height deps removed as we use observer */
    ]
  );

  // VRMファイル読み込み
  useEffect(() => {
    if (modelId) {
      // モデルIDから読み込み
      setLoading(true);
      setError(null);
      onLoadStart?.();

      const loadFromModelId = async () => {
        try {
          console.log("VRMViewer - loading model:", modelId);
          // VRoid API経由でダウンロードライセンスを取得
          const licenseResponse = await fetch(`/api/vroid/download-license`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model_id: modelId }),
          });

          if (!licenseResponse.ok) {
            const errorData = await licenseResponse.json().catch(() => ({}));
            throw new Error(
              errorData.error ||
                `Failed to get download license: ${licenseResponse.status}`
            );
          }

          const licenseData = await licenseResponse.json();
          console.log("License data received:", licenseData);

          if (licenseData.success && licenseData.url) {
            if (licenseData.proxy) {
              // プロキシ経由の場合は直接Blobとしてfetchしてから読み込み
              console.log("Loading VRM via proxy:", licenseData.url);
              const vrmResponse = await fetch(licenseData.url);
              if (!vrmResponse.ok) {
                throw new Error(
                  `Failed to fetch VRM file: ${vrmResponse.statusText}`
                );
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
              console.log("Loading VRM directly:", licenseData.url);
              await loadVRM(licenseData.url);
            }
          } else {
            throw new Error("No download URL available");
          }
        } catch (error) {
          console.error("VRM modelId読み込みエラー:", error);
          const errorMessage =
            error instanceof Error
              ? error.message
              : "モデルIDからのVRM読み込みに失敗しました";
          setError(errorMessage);
          onLoadError?.(
            error instanceof Error ? error : new Error(errorMessage)
          );
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

  // (Skipping down to resetPosition)

  // 表示切り替え
  const toggleVisibility = () => {
    if (vrmRef.current) {
      vrmRef.current.scene.visible = !isVisible;
      setIsVisible(!isVisible);
    }
  };

  // リセット
  const resetPosition = () => {
    if (vrmRef.current && initialTransformRef.current) {
      vrmRef.current.scene.rotation.set(0, 0, 0);
      vrmRef.current.scene.position.copy(initialTransformRef.current.position);
      vrmRef.current.scene.scale.copy(initialTransformRef.current.scale);

      // カメラとコントロールもリセットすると親切かも
      if (cameraRef.current && controlsRef.current) {
        cameraRef.current.position.set(0, 1.0, 4.0);
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }
    } else if (vrmRef.current) {
      // Fallback if no initial transform saved (should rarely happen)
      vrmRef.current.scene.rotation.set(0, 0, 0);
      vrmRef.current.scene.position.set(0, 0, 0);
    }
  };

  // カメラ移動
  const moveCamera = (direction: "up" | "down" | "left" | "right") => {
    if (!cameraRef.current || !controlsRef.current) return;

    const offset = 0.2; // 移動量
    const v = new THREE.Vector3();

    // カメラの右方向ベクトルを取得（回転に合わせるため）
    const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(
      cameraRef.current.quaternion
    );
    cameraRight.y = 0; // 水平移動のみ
    cameraRight.normalize();

    // カメラの上方向（画面上の上）を取得
    // OrbitControlsでの「上」は通常Y軸プラスだが、カメラの向きに依存させたい場合はUpVectorを使う
    // ここでは単純にY軸移動（World Up）と、カメラ右方向（World Right）を使う

    switch (direction) {
      case "up":
        cameraRef.current.position.y += offset;
        controlsRef.current.target.y += offset;
        break;
      case "down":
        cameraRef.current.position.y -= offset;
        controlsRef.current.target.y -= offset;
        break;
      case "left":
        cameraRef.current.position.addScaledVector(cameraRight, -offset);
        controlsRef.current.target.addScaledVector(cameraRight, -offset);
        break;
      case "right":
        cameraRef.current.position.addScaledVector(cameraRight, offset);
        controlsRef.current.target.addScaledVector(cameraRight, offset);
        break;
    }
    controlsRef.current.update();
  };

  // ズーム
  const zoomCamera = (zoomIn: boolean) => {
    if (!cameraRef.current || !controlsRef.current) return;

    const zoomSpeed = 0.5;
    const direction = new THREE.Vector3();
    cameraRef.current.getWorldDirection(direction);

    if (zoomIn) {
      cameraRef.current.position.addScaledVector(direction, zoomSpeed);
    } else {
      cameraRef.current.position.addScaledVector(direction, -zoomSpeed);
    }
    controlsRef.current.update();
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
        <CardDescription>3Dモデルビューア（Three.js + VRM）</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* 3Dビューア */}
          <div
            ref={mountRef}
            className="border rounded-md bg-gray-50 relative overflow-hidden w-full"
            style={{ height }}
          >
            {/* Camera Controls Overlay */}
            <div className="absolute right-4 bottom-4 flex flex-col items-center gap-1 z-10 bg-white/80 p-2 rounded-lg shadow-sm border">
              <div className="flex gap-1 justify-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => moveCamera("up")}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => moveCamera("left")}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => moveCamera("down")}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => moveCamera("right")}
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-1 mt-2 border-t pt-2 w-full justify-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => zoomCamera(true)}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => zoomCamera(false)}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </div>
            </div>

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
              <p>
                ポリゴン数: {vrmRef.current.scene.children.length}オブジェクト
              </p>
              <p>自動回転: 無効</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
