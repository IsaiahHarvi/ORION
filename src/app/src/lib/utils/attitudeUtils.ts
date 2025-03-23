// src/lib/utils/attitudeUtils.ts

/**
 * Combine platformAttitude (heading/pitch/roll) with gimbalAttitude (yaw/pitch/roll)
 * into a single "absolute" camera heading/pitch in the ground (NED) frame.
 *
 * This is a simplified approach: heading(0) = north, positive pitch = up.
 * For advanced usage, do full 3D rotation or quaternions.
 *
 * @param platformHeading heading from true north, measured clockwise [0..360)
 * @param platformPitch   pitch of the platform, positive = up from horizontal
 * @param gimbalYaw       yaw of the gimbal relative to the platform's forward axis
 * @param gimbalPitch     pitch of the gimbal relative to the platform's forward axis
 * @returns { heading, pitch } in ground frame
 */
export function combinePlatformAndGimbal(
    platformHeading: number,
    platformPitch: number,
    gimbalYaw: number,
    gimbalPitch: number
  ): { heading: number; pitch: number } {
    // 1) heading = platformHeading + gimbalYaw
    let cameraHeading = (platformHeading + gimbalYaw) % 360;
    if (cameraHeading < 0) cameraHeading += 360;
  
    // 2) pitch = platformPitch + gimbalPitch
    let cameraPitch = platformPitch + gimbalPitch;
    if (cameraPitch > 90) cameraPitch = 90;
    if (cameraPitch < -90) cameraPitch = -90;
  
    return { heading: cameraHeading, pitch: cameraPitch };
  }
  