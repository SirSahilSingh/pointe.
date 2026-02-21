import cv2
import mediapipe as mp
import numpy as np


class FaceMeshDetector:
    def __init__(self, static_mode=False, max_faces=1, min_detection_con=0.5, min_track_con=0.5):
        self.static_mode = static_mode
        self.max_faces = max_faces
        self.min_detection_con = min_detection_con
        self.min_track_con = min_track_con

        self.mp_draw = mp.solutions.drawing_utils
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=self.static_mode,
            max_num_faces=self.max_faces,
            refine_landmarks=True,
            min_detection_confidence=self.min_detection_con,
            min_tracking_confidence=self.min_track_con
        )
        self.draw_spec = self.mp_draw.DrawingSpec(thickness=1, circle_radius=1)

    def process_frame(self, img, draw=True):
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        self.results = self.face_mesh.process(img_rgb)

        if self.results.multi_face_landmarks:
            if draw:
                for face_landmarks in self.results.multi_face_landmarks:
                    self.mp_draw.draw_landmarks(
                        image=img,
                        landmark_list=face_landmarks,
                        connections=self.mp_face_mesh.FACEMESH_TESSELATION,
                        landmark_drawing_spec=self.draw_spec,
                        connection_drawing_spec=self.draw_spec)
        return img, self.results