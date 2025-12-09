"use client";

import React, { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { VRM, VRMHumanBoneName } from "@pixiv/three-vrm";
import { VRMViewer } from "@/components/vrm/VRMViewer";
import { Participant, DataPacket_Kind, ParticipantEvent } from "livekit-client";
import {
  MotionDataPacket,
  QuaternionArray,
  AvatarMetadata,
  BoneRotations,
} from "@/types/avatar";
import * as THREE from "three";

interface AvatarReceiverProps {
  participant: Participant;
  defaultAvatarUrl?: string;
  manualRotations?: BoneRotations | null; // ローカルプレビュー用ループバック
  localOverrideOffset?: { x: number; y: number; z: number }; // ローカル即時反映用のオフセット上書き
  localOverrideScale?: number; // ローカル即時反映用のスケール上書き
}

export const AvatarReceiver: React.FC<AvatarReceiverProps> = ({
  participant,
  defaultAvatarUrl,
  manualRotations,
  localOverrideOffset,
  localOverrideScale,
}) => {
  const vrmRef = useRef<VRM | null>(null);
  const [vrmUrl, setVrmUrl] = useState<string | null>(defaultAvatarUrl || null); // 初期URLを設定
  const [remoteOffset, setRemoteOffset] = useState<{
    x: number;
    y: number;
    z: number;
  } | null>(null);
  const [remoteScale, setRemoteScale] = useState<number>(1.0);
  const [isCameraActive, setIsCameraActive] = useState(false); // Data v=1/0

  // アニメーション補間用のターゲット回転情報
  const targetRotations = useRef<Record<string, THREE.Quaternion>>({});

  // MetadataからVRM URLを取得
  useEffect(() => {
    if (!participant) return;

    // メタデータ更新処理
    const updateMetadata = () => {
      // メタデータが存在する場合は適用する
      if (participant.metadata) {
        try {
          const meta = JSON.parse(participant.metadata) as AvatarMetadata;
          if (meta && meta.avatarUrl) {
            setVrmUrl(meta.avatarUrl);
            if (meta.offset) {
              setRemoteOffset(meta.offset);
            }
            // scaleは常に設定する。未設定の場合はデフォルト値(1.0)を使用
            const newScale = meta.scale ?? 1.0;
            setRemoteScale(newScale);

            // console.log(`Metadata update for ${participant.identity}:`, meta);
            return;
          }
        } catch (e) {
          console.warn("Failed to parse participant metadata", e);
        }
      }
      // メタデータがない、または無効な場合はデフォルトURLを使用
      if (defaultAvatarUrl) {
        setVrmUrl(defaultAvatarUrl);
      }
    };

    updateMetadata();
    participant.on(ParticipantEvent.ParticipantMetadataChanged, updateMetadata);

    return () => {
      participant.off(
        ParticipantEvent.ParticipantMetadataChanged,
        updateMetadata
      );
    };
  }, [participant, defaultAvatarUrl]);

  // データ受信ハンドラ
  useEffect(() => {
    const handleData = (payload: Uint8Array) => {
      // Note: topicはParticipant.on('dataReceived')の全てのバージョン/タイプで厳密に渡されるわけではありません。
      // パケットをフィルタリングするために、内容チェック (t: 'm') に依存しています。

      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text) as MotionDataPacket;

        if (data.t !== "m") return;

        // カメラのアクティブ状態を更新
        setIsCameraActive(data.v === 1);

        // ターゲット回転情報を更新
        if (data.v === 1 && data.bones) {
          Object.entries(data.bones).forEach(([boneJsonName, quatArray]) => {
            // 必要に応じてavatar.tsのボーン名をVRMボーン名に変換する。
            // ただし、AvatarSenderでは互換性のある名前（camelCase）を使用している。
            // 厳密な場合は、`spine`、`chest`などをVRMHumanBoneNameにマッピングする必要がある。
            // VRMHumanBoneNameの値は'spine'、'chest'など。

            if (quatArray) {
              const q = new THREE.Quaternion(
                quatArray[0],
                quatArray[1],
                quatArray[2],
                quatArray[3]
              );
              targetRotations.current[boneJsonName] = q;
            }
          });
        }
      } catch (err) {
        console.error("Error decoding motion data", err);
      }
    };

    participant.on("dataReceived", handleData);

    return () => {
      participant.off("dataReceived", handleData);
    };
  }, [participant]);

  // 毎フレーム実行: ターゲット回転に向けて補間アニメーション
  useFrame((state, delta) => {
    const vrm = vrmRef.current;
    if (!vrm) return;

    // ローカルループバック (AvatarSenderからの手動回転データ)
    if (manualRotations) {
      // ローカルは30fpsで更新されるため、補間なしで即時適用
      applyBoneRotations(vrm, manualRotations);
    }
    // ネットワークデータ (ターゲット回転へのLerp補間)
    else if (isCameraActive) {
      Object.entries(targetRotations.current).forEach(
        ([boneName, targetQuat]) => {
          const boneNode = vrm.humanoid?.getNormalizedBoneNode(
            boneName as VRMHumanBoneName
          );
          if (boneNode) {
            const lerpFactor = 10 * delta;
            boneNode.quaternion.slerp(targetQuat, Math.min(lerpFactor, 1.0));
          }
        }
      );
    }

    vrm.update(delta);
  });

  if (!vrmUrl) return null;

  // 最終的な位置を決定: ローカル上書き > リモートMetadata > デフォルト
  const position: [number, number, number] = localOverrideOffset
    ? [localOverrideOffset.x, localOverrideOffset.y, localOverrideOffset.z]
    : remoteOffset
      ? [remoteOffset.x, remoteOffset.y, remoteOffset.z]
      : [0, 0, 0];

  const scaleValue = localOverrideScale ?? remoteScale ?? 1.0;
  const scale: [number, number, number] = [scaleValue, scaleValue, scaleValue];

  return (
    <VRMViewer
      vrmUrl={vrmUrl}
      onVRMLoaded={(vrm) => {
        vrmRef.current = vrm;
      }}
      // propsが提供されない場合はデフォルトを使用
      position={position}
      rotation={[0, 0, 0]}
      scale={scale}
    />
  );
};

// ヘルパー: ボーン回転を直接適用（ローカルループバック用）
const applyBoneRotations = (vrm: VRM, rotations: BoneRotations) => {
  const apply = (name: string, qArr?: QuaternionArray) => {
    if (!qArr) return;
    const node = vrm.humanoid?.getNormalizedBoneNode(name as VRMHumanBoneName);
    if (node) {
      const q = new THREE.Quaternion(qArr[0], qArr[1], qArr[2], qArr[3]);
      node.quaternion.copy(q);
    }
  };

  apply("hips", rotations.hips);
  apply("spine", rotations.spine);
  apply("chest", rotations.chest);
  apply("upperChest", rotations.upperChest);
  apply("neck", rotations.neck);
  apply("head", rotations.head);

  apply("leftShoulder", rotations.leftShoulder);
  apply("leftUpperArm", rotations.leftUpperArm);
  apply("leftLowerArm", rotations.leftLowerArm);
  apply("leftHand", rotations.leftHand);

  apply("rightShoulder", rotations.rightShoulder);
  apply("rightUpperArm", rotations.rightUpperArm);
  apply("rightLowerArm", rotations.rightLowerArm);
  apply("rightHand", rotations.rightHand);

  apply("leftUpperLeg", rotations.leftUpperLeg);
  apply("leftLowerLeg", rotations.leftLowerLeg);
  apply("leftFoot", rotations.leftFoot);

  apply("rightUpperLeg", rotations.rightUpperLeg);
  apply("rightLowerLeg", rotations.rightLowerLeg);
  apply("rightFoot", rotations.rightFoot);
};
