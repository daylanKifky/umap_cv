/**
 * Unified configuration file for the 3D Article Visualization
 * All configuration constants are centralized here
 */

// ============================================================================
// Visualization & Rendering
// ============================================================================
const REDUCTION_METHOD = 'pca';
const SHOW_AXES = false;
const FXAA_RESOLUTION = 0.7;
const SHOW_THREE_STATS = false;

// ============================================================================
// Camera Settings
// ============================================================================
const CAMERA_INITIAL_POSITION = { x: 20, y: 10, z: 20 };
const CAMERA_ANIMATION_DURATION = 1000;
const HOVER_CHECK_INTERVAL = 100; // Check every 100ms max

// ============================================================================
// Bloom Post-Processing
// ============================================================================
const BLOOM_ENABLED = true;

// ============================================================================
// Card Display Settings
// ============================================================================
const FONT_NAME = "Space Grotesk";
const CARD_WINDOW_SCALE = 0.5; // Cards are scaled to this factor of the window size
const CARD_BOTTOM_PADDING = 0.2;

// Small card dimensions and offsets
const SM_CARD_OFFSET_X = -0.4; // negative value moves the card to the left
const SM_CARD_OFFSET_Y = -0.25; // negative value moves the card up
const SM_CARD_OFFSET_Z = 0;
const SM_CARD_W = 300;
const SM_CARD_H = 400;

// Card text settings
const CARD_TITLE_LENGTH = 100;
const CARD_TITLE_LINES = 2;
const CARD_CONTENT_LINES = 3;
const CARD_CONTENT_LENGTH = 300;

// Card UI text
const SEE_MORE_TEXT = "see more";

// ============================================================================
// User Controls & Autoplay
// ============================================================================
const INITIAL_DELAY = 2000;
const AUTO_PLAY_DELAY = 8000;
const UPDATE_INTERVAL = 12000;
const MAX_HISTORY_SIZE = 5;

// ============================================================================
// Similarity & Scaling
// ============================================================================
const SIM_TO_SCALE_POW = 0.3;
const SIM_TO_SCALE_MIN = 0.5;
const SIM_TO_SCALE_MAX = 1.5;

// ============================================================================
// Color Conversion
// ============================================================================
const COLOR_SATURATION = 0.6;
const COLOR_LIGHTNESS = 0.7;

// ============================================================================
// Camera Distance Multipliers
// ============================================================================
const SINGLE_TARGET_MULTIPLIER = 1.5;
const MULTI_TARGET_MULTIPLIER = 1.1;

// ============================================================================
// Embeddings File
// ============================================================================
const EMBEDDINGS_FILE = "embeddings.json";

// ============================================================================
// Debug Flags
// ============================================================================
const DEBUG_VIEW_DIRECTION = false;
const DEBUG_CARD_CORNER = false;

