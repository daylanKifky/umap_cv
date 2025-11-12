import numpy as np
from typing import Tuple
from math import pi

def create_connecting_arc(point_a: np.ndarray, point_b: np.ndarray, steps: int = 3) -> np.ndarray:
    """
    Create a smooth connecting arc between two 3D coordinates using subdivision.

    This function creates a smooth curve that connects point_a to point_b while
    passing through/near the origin (0,0,0). It uses a subdivision approach similar
    to Catmull-Clark but adapted for curve generation.

    Args:
        point_a: First 3D coordinate (numpy array of shape (3,))
        point_b: Second 3D coordinate (numpy array of shape (3,))
        steps: Number of subdivision iterations (default: 3)

    Returns:
        Numpy array of shape (n, 3) containing the vertices of the arc
    """
    # Ensure inputs are numpy arrays
    point_a = np.asarray(point_a, dtype=np.float64)
    point_b = np.asarray(point_b, dtype=np.float64)

    if point_a.shape != (3,) or point_b.shape != (3,):
        raise ValueError("Input points must be 3D coordinates")

    # Create the initial control points: A, O, B where O is origin
    origin = np.array([0.0, 0.0, 0.0])

    distance = np.linalg.norm(point_a - point_b)
    dot_product = np.dot(point_a, point_b)
    angle = np.arccos(dot_product / (np.linalg.norm(point_a) * np.linalg.norm(point_b)))

    proximity_factor = max(dot_product,0) / (np.linalg.norm(point_a) * np.linalg.norm(point_b))
    MIN_DEFORM = 0.4
    MAX_DEFORM = 0.75
    deform_factor = MIN_DEFORM + (MAX_DEFORM - MIN_DEFORM) * proximity_factor

    center = (point_a + point_b) / 2
    center *= deform_factor

    control_points = np.array([point_a, center, point_b])

    # Apply subdivision steps to create smooth curve
    vertices = control_points.copy()

    for step in range(steps):
        vertices = subdivide_curve(vertices)

    return vertices


def subdivide_curve(control_points: np.ndarray) -> np.ndarray:
    """
    Apply one step of curve subdivision using Catmull-Rom-like interpolation.

    Args:
        control_points: Array of shape (n, 3) containing control points

    Returns:
        Array of shape (2*n-1, 3) with subdivided points
    """
    n = len(control_points)

    if n < 2:
        return control_points.copy()

    # For Catmull-Rom-like subdivision, we need to handle edge cases
    new_points = []

    # Add first point
    new_points.append(control_points[0])

    # Add intermediate points
    for i in range(n - 1):
        p0 = control_points[i]
        p1 = control_points[i + 1]

        # Calculate two intermediate points between p0 and p1
        # First intermediate point (closer to p0)
        t = 0.25
        mid1 = (1 - t) * p0 + t * p1

        # Second intermediate point (closer to p1)
        t = 0.75
        mid2 = (1 - t) * p0 + t * p1

        new_points.append(mid1)
        new_points.append(mid2)

    # Add last point
    new_points.append(control_points[-1])

    return np.array(new_points)


# Alternative implementation using proper Catmull-Rom spline interpolation
def create_catmull_rom_arc(point_a: np.ndarray, point_b: np.ndarray, steps: int = 3) -> np.ndarray:
    """
    Create a smooth connecting arc using Catmull-Rom spline interpolation.

    Args:
        point_a: First 3D coordinate
        point_b: Second 3D coordinate
        steps: Number of subdivision steps

    Returns:
        Numpy array of vertices forming the arc
    """
    point_a = np.asarray(point_a, dtype=np.float64)
    point_b = np.asarray(point_b, dtype=np.float64)

    # Create control points for Catmull-Rom spline
    # We need 4 control points for a proper Catmull-Rom spline
    # Use: A, (A + O)/2, (O + B)/2, B
    origin = np.array([0.0, 0.0, 0.0])

    p0 = point_a
    p1 = (point_a + origin) / 2
    p2 = (origin + point_b) / 2
    p3 = point_b

    control_points = np.array([p0, p1, p2, p3])

    # Generate points along the Catmull-Rom spline
    num_segments = len(control_points) - 1
    points_per_segment = 2 ** steps  # Increase resolution with each step

    vertices = []

    for i in range(num_segments):
        p0 = control_points[i]
        p1 = control_points[i + 1]

        # Handle boundary conditions for Catmull-Rom
        if i == 0:
            # First segment: use p0, p1, and extrapolate p-1
            pm1 = 2 * p0 - p1  # Extrapolate backward
        else:
            pm1 = control_points[i - 1]

        if i == num_segments - 1:
            # Last segment: use p0, p1, and extrapolate p2
            pp2 = 2 * p1 - p0  # Extrapolate forward
        else:
            pp2 = control_points[i + 2]

        # Generate points for this segment
        segment_points = catmull_rom_segment(pm1, p0, p1, pp2, points_per_segment)
        vertices.extend(segment_points[:-1])  # Avoid duplicating points

    # Add the final point
    vertices.append(control_points[-1])

    return np.array(vertices)


def catmull_rom_segment(p0: np.ndarray, p1: np.ndarray, p2: np.ndarray, p3: np.ndarray,
                       num_points: int) -> np.ndarray:
    """
    Generate points along a Catmull-Rom spline segment.

    Args:
        p0, p1, p2, p3: Control points
        num_points: Number of points to generate

    Returns:
        Array of points along the spline segment
    """
    points = []

    for i in range(num_points + 1):
        t = i / num_points

        # Catmull-Rom interpolation formula
        tt = t * t
        ttt = tt * t

        # Catmull-Rom basis matrix coefficients
        q1 = -ttt + 2*tt - t
        q2 = 3*ttt - 5*tt + 2
        q3 = -3*ttt + 4*tt + t
        q4 = ttt - tt

        # Apply coefficients with 0.5 alpha (standard Catmull-Rom)
        point = 0.5 * (q1 * p0 + q2 * p1 + q3 * p2 + q4 * p3)
        points.append(point)

    return np.array(points)