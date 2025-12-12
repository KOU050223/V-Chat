import React, { useMemo } from "react";
// Forced update check

import * as THREE from "three";
import { PoseLandmark } from "@/hooks/usePoseEstimation";

interface DebugSkeletonProps {
  landmarks: PoseLandmark[] | null;
  position?: [number, number, number];
  scale?: number;
  yOffset?: number; // Added yOffset prop
  visible?: boolean;
}

export const DebugSkeleton: React.FC<DebugSkeletonProps> = ({
  landmarks,
  position = [0, 0, 0],
  scale = 1,
  yOffset = 1, // Default to 1 to match typically normalized MediaPipe coordinates (0-1)
  visible = true,
}) => {
  // MediaPipe Pose Connections (Simplified)
  // [start, end] indices
  const connections = useMemo(
    () => [
      // Torso
      [11, 12], // shoulder-shoulder
      [11, 23], // shoulder-hip (left)
      [12, 24], // shoulder-hip (right)
      [23, 24], // hip-hip
      // Arms
      [11, 13], // l.shoulder-l.elbow
      [13, 15], // l.elbow-l.wrist
      [12, 14], // r.shoulder-r.elbow
      [14, 16], // r.elbow-r.wrist
      // Hands (simple)
      [15, 17],
      [15, 19],
      [15, 21],
      [16, 18],
      [16, 20],
      [16, 22],
      // Legs (optional, but good to have)
      [23, 25],
      [25, 27],
      [24, 26],
      [26, 28],
    ],
    []
  );

  // Reusable geometry and materials for performance
  const jointGeometry = useMemo(() => new THREE.SphereGeometry(0.03, 8, 8), []);
  const boneMaterial = useMemo(
    () => new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 }),
    []
  );

  // Left: Blue, Right: Red, Center: White
  const leftJointMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: 0x0088ff }),
    []
  );
  const rightJointMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: 0xff4444 }),
    []
  );
  const centerJointMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: 0xffffff }),
    []
  );

  // Clean up resources on unmount
  React.useEffect(() => {
    return () => {
      jointGeometry.dispose();
      boneMaterial.dispose();
      leftJointMaterial.dispose();
      rightJointMaterial.dispose();
      centerJointMaterial.dispose();
    };
  }, [
    jointGeometry,
    boneMaterial,
    leftJointMaterial,
    rightJointMaterial,
    centerJointMaterial,
  ]);

  if (!visible || !landmarks || landmarks.length === 0) return null;

  return (
    <group position={position}>
      {/* Draw Joints */}
      {landmarks.map((lm, index) => {
        if ((lm.visibility ?? 1) < 0.3) return null;

        // Determine color based on index
        // Even indices are usually right side in MediaPipe (except nose=0)
        // Odd indices are left side
        // But let's be specific for main limbs
        let material = centerJointMaterial;
        if (index >= 11) {
          // Body parts
          if (index % 2 !== 0)
            material = leftJointMaterial; // 11,13,15... Left
          else material = rightJointMaterial; // 12,14,16... Right
        }

        return (
          <mesh
            key={`joint-${index}`}
            geometry={jointGeometry}
            material={material}
            position={[
              -lm.x * scale, // Mirror X for correct 3D facing
              -lm.y * scale + yOffset, // Flip Y (MediaPipe is top-down 0-1) + offset to stand
              -lm.z * scale,
            ]}
          />
        );
      })}

      {/* Draw Bones (Lines) */}
      {connections.map(([start, end], i) => {
        const startLm = landmarks[start];
        const endLm = landmarks[end];

        if (
          !startLm ||
          !endLm ||
          (startLm.visibility ?? 1) < 0.3 ||
          (endLm.visibility ?? 1) < 0.3
        )
          return null;

        const startPos = new THREE.Vector3(
          -startLm.x * scale,
          -startLm.y * scale + yOffset,
          -startLm.z * scale
        );
        const endPos = new THREE.Vector3(
          -endLm.x * scale,
          -endLm.y * scale + yOffset,
          -endLm.z * scale
        );

        const geometry = new THREE.BufferGeometry().setFromPoints([
          startPos,
          endPos,
        ]);

        return (
          <lineSegments
            key={`bone-${i}`}
            geometry={geometry}
            material={boneMaterial}
          />
        );
      })}
    </group>
  );
};
