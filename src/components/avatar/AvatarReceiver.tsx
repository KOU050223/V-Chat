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
  manualRotations?: BoneRotations | null; // For local preview loopback
}

export const AvatarReceiver: React.FC<AvatarReceiverProps> = ({
  participant,
  defaultAvatarUrl,
  manualRotations,
}) => {
  const vrmRef = useRef<VRM | null>(null);
  const [vrmUrl, setVrmUrl] = useState<string | null>(defaultAvatarUrl || null); // Initialize with default
  const [isCameraActive, setIsCameraActive] = useState(false); // Data v=1/0

  // Animation targets (for Lerp)
  const targetRotations = useRef<Record<string, THREE.Quaternion>>({});

  // MetadataからVRM URLを取得
  useEffect(() => {
    if (!participant) return;

    // Metadata check function
    const updateMetadata = () => {
      // If metadata exists, try to use it
      if (participant.metadata) {
        try {
          const meta = JSON.parse(participant.metadata) as AvatarMetadata;
          if (meta && meta.avatarUrl) {
            setVrmUrl(meta.avatarUrl);
            return;
          }
        } catch (e) {
          console.warn("Failed to parse participant metadata", e);
        }
      }
      // If no metadata or invalid, fall back to default if provided
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
    if (!participant) return;

    const handleData = (payload: Uint8Array) => {
      // Note: topic is not strictly passed in Participant.on('dataReceived') in all versions/types.
      // We rely on the content check (t: 'm') to filter our packets.

      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text) as MotionDataPacket;

        if (data.t !== "m") return;

        // Debug log
        if (data.v === 1 && Math.random() < 0.05) {
          console.log(
            "Received motion packet:",
            Object.keys(data.bones || {}).length,
            "bones",
            "from",
            participant.identity
          );
        }

        // Update Camera Active State
        setIsCameraActive(data.v === 1);

        // Update Target Rotations
        if (data.v === 1 && data.bones) {
          Object.entries(data.bones).forEach(([boneJsonName, quatArray]) => {
            // Convert avatar.ts bone names to VRM bone names if needed,
            // but we used compatible names in AvatarSender (camelCase).
            // Need to map our `spine`, `chest` to VRMHumanBoneName if strict.
            // VRMHumanBoneName values are like 'spine', 'chest'.

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

  // Every frame, interpolate towards target rotations
  useFrame((state, delta) => {
    const vrm = vrmRef.current;
    if (!vrm) return;

    // Local Loopback (Manual Rotations from AvatarSender)
    if (manualRotations) {
      // Apply immediately without interpolation (since it's 30fps local)
      applyBoneRotations(vrm, manualRotations);
    }
    // Network Data (Target Rotations with Lerp)
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

  return (
    <VRMViewer
      vrmUrl={vrmUrl}
      onVRMLoaded={(vrm) => {
        vrmRef.current = vrm;
      }}
      // Use defaults if props are not provided (though we removed them from interface, we can add them back or hardcode default)
      position={[0, 0, 0]}
      rotation={[0, 0, 0]}
      scale={[1, 1, 1]}
    />
  );
};

// Helper: Apply bone rotations directly (for local loopback)
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
