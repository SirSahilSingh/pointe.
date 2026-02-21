import cv2
import numpy as np


class HeadPoseEstimator:
    def __init__(self, img_w, img_h):
        self.img_w = img_w
        self.img_h = img_h

        # 3D Model Points (Generic Human Face)
        self.face_3d = np.array([
            [0.0, 0.0, 0.0],  # Nose tip
            [0.0, -330.0, -65.0],  # Chin
            [-225.0, 170.0, -135.0],  # Left eye left corner
            [225.0, 170.0, -135.0],  # Right eye right corner
            [-150.0, -150.0, -125.0],  # Left Mouth corner
            [150.0, -150.0, -125.0]  # Right mouth corner
        ], dtype=np.float64)

        # 2D Landmark Indices (MediaPipe)
        self.face_2d_idx = [1, 199, 33, 263, 61, 291]

        # Camera Internals (Approximation)
        self.focal_length = 1 * self.img_w
        self.cam_matrix = np.array([
            [self.focal_length, 0, self.img_h / 2],
            [0, self.focal_length, self.img_w / 2],
            [0, 0, 1]
        ])
        self.dist_matrix = np.zeros((4, 1), dtype=np.float64)

    def get_pose(self, face_landmarks):
        face_2d = []
        for idx in self.face_2d_idx:
            lm = face_landmarks.landmark[idx]
            x, y = int(lm.x * self.img_w), int(lm.y * self.img_h)
            face_2d.append([x, y])

        face_2d = np.array(face_2d, dtype=np.float64)

        # Solve PnP
        success, rot_vec, trans_vec = cv2.solvePnP(
            self.face_3d, face_2d, self.cam_matrix, self.dist_matrix
        )

        # Get Nose Point for visualization
        nose_2d = (int(face_2d[0][0]), int(face_2d[0][1]))

        return rot_vec, trans_vec, nose_2d

    def draw_axes(self, img, rot_vec, trans_vec, nose_pt):
        # Project 3D axis points to 2D image plane
        axis_len = 50.0  # Length of the axis lines

        # X-axis (Right), Y-axis (Down), Z-axis (Forward)
        axis_3d = np.float32([[axis_len, 0, 0], [0, axis_len, 0], [0, 0, axis_len]])

        imgpts, _ = cv2.projectPoints(axis_3d, rot_vec, trans_vec, self.cam_matrix, self.dist_matrix)

        # Draw lines
        # Nose to X (Red)
        cv2.line(img, nose_pt, tuple(imgpts[0].ravel().astype(int)), (0, 0, 255), 3)
        # Nose to Y (Green)
        cv2.line(img, nose_pt, tuple(imgpts[1].ravel().astype(int)), (0, 255, 0), 3)
        # Nose to Z (Blue)
        cv2.line(img, nose_pt, tuple(imgpts[2].ravel().astype(int)), (255, 0, 0), 3)