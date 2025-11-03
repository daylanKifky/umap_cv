#!/usr/bin/env python3
"""
Build script to prepare static site for deployment.
Copies source files from src/ to public/ and runs the processing pipeline.
"""

import shutil
import argparse
from pathlib import Path
from typing import List, Dict, Any

try:
    import tomllib
except ImportError:
    try:
        import tomli as tomllib
    except ImportError:
        raise ImportError("tomllib (Python 3.11+) or tomli is required. Install with: pip install tomli")

try:
    import jinja2
except ImportError:
    raise ImportError("jinja2 is required. Install it with: pip install jinja2")

# Import process module
from .process import main as process_main


def load_config(config_path: Path) -> Dict[str, Any]:
    """
    Load configuration from TOML file.
    
    Args:
        config_path: Path to config.toml file
        
    Returns:
        Dictionary containing configuration
    """
    if not config_path.exists():
        raise FileNotFoundError(f"Configuration file not found: {config_path}")
    
    with open(config_path, 'rb') as f:
        return tomllib.load(f)


def normalize_base_url(base_url: str) -> str:
    """
    Normalize base_url to ensure consistent format.
    - Empty string stays empty
    - Paths without trailing slash get one added
    - Root path "/" stays as "/"
    
    Args:
        base_url: Base URL string from config
        
    Returns:
        Normalized base URL
    """
    if not base_url:
        return ""
    # Remove leading/trailing whitespace
    base_url = base_url.strip()
    # Ensure it starts with /
    if not base_url.startswith('/'):
        base_url = '/' + base_url
    # Ensure it ends with / (unless it's just "/")
    if base_url != '/' and not base_url.endswith('/'):
        base_url = base_url + '/'
    return base_url


def render_templates(src_dir: Path, public_dir: Path, config: Dict[str, Any]):
    """
    Render Jinja2 templates from src/templates/ to public/.
    
    Args:
        src_dir: Source directory (udim_cv/src)
        public_dir: Output directory (udim_cv/public)
        config: Configuration dictionary
    """
    print("📄 Rendering HTML templates...")
    
    templates_dir = src_dir / 'templates'
    if not templates_dir.exists():
        print(f"  ⚠ Warning: {templates_dir} not found")
        return
    
    # Normalize base_url
    if 'site' not in config:
        config['site'] = {}
    base_url = normalize_base_url(config['site'].get('base_url', ''))
    config['site']['base_url'] = base_url
    
    # Set up Jinja2 environment
    env = jinja2.Environment(
        loader=jinja2.FileSystemLoader(str(templates_dir)),
        autoescape=jinja2.select_autoescape(['html', 'xml'])
    )
    
    # Add filter to prepend base_url to paths
    def url_filter(path: str) -> str:
        """Prepend base_url to a path if base_url is set."""
        if not base_url:
            return path
        # Remove leading slash from path if it exists (we'll add base_url which ends with /)
        path = path.lstrip('/')
        return base_url + path
    
    env.filters['url'] = url_filter
    
    # Render index.html
    template = env.get_template('index.html')
    output = template.render(config=config)
    
    output_file = public_dir / 'index.html'
    output_file.write_text(output, encoding='utf-8')
    print(f"  ✓ index.html rendered")


def copy_source_files(src_dir: Path, public_dir: Path, config: Dict[str, Any]):
    """
    Copy all source files from src/ to public/ and render templates.
    
    Args:
        src_dir: Source directory (udim_cv/src)
        public_dir: Output directory (udim_cv/public)
        config: Configuration dictionary
    """
    print("🏗️  Building static site...")
    
    # Ensure public directory exists
    public_dir.mkdir(exist_ok=True)
    
    # 1. Render HTML templates
    render_templates(src_dir, public_dir, config)
    
    # 2. Copy JavaScript files
    print("📜 Copying JavaScript files...")
    js_src = src_dir / 'js'
    if js_src.exists():
        js_files = list(js_src.glob('*.js'))
        if js_files:
            for js_file in js_files:
                shutil.copy(js_file, public_dir / js_file.name)
                print(f"  ✓ {js_file.name}")
        else:
            print("  ⚠ No JavaScript files found")
    else:
        print(f"  ⚠ Warning: {js_src} not found")
    
    # 3. Copy CSS files
    print("🎨 Copying CSS files...")
    css_src = src_dir / 'css'
    if css_src.exists():
        css_files = list(css_src.glob('*.css'))
        if css_files:
            for css_file in css_files:
                shutil.copy(css_file, public_dir / css_file.name)
                print(f"  ✓ {css_file.name}")
        else:
            print("  ⚠ No CSS files found")
    else:
        print(f"  ⚠ Warning: {css_src} not found")
    
    # 4. Copy static assets
    print("🖼️  Copying static assets...")
    assets_src = src_dir / 'assets'
    if assets_src.exists():
        assets = [a for a in assets_src.iterdir() if a.is_file()]
        if assets:
            for asset in assets:
                shutil.copy(asset, public_dir / asset.name)
                print(f"  ✓ {asset.name}")
        else:
            print("  ⚠ No asset files found")
    else:
        print(f"  ⚠ Warning: {assets_src} not found")
    
    print("✅ Source files copied\n")


def build(
    input_folder: str = None,
    output_dir: str = None,
    methods: List[str] = None,
    dimensions: List[int] = None,
    skip_confirmation: bool = False,
    copy_only: bool = False,
    config_path: str = None,
    base_url: str = None
):
    """
    Main build function that copies source files and runs processing pipeline.
    
    Args:
        input_folder: Path to folder containing markdown files (default: articles/ relative to build.py)
        output_dir: Output directory for build (default: build/public/ relative to project root)
        methods: Dimensionality reduction methods to use (default: ['pca'])
        dimensions: Output dimensions (default: [3])
        skip_confirmation: Skip confirmation prompts
        copy_only: Only copy source files, skip processing
        config_path: Path to config.toml file (default: config.toml relative to build.py)
        base_url: Base URL override (default: None, uses config file value)
    """
    # Define paths relative to this file
    udim_cv_dir = Path(__file__).parent
    project_root = udim_cv_dir.parent
    src_dir = udim_cv_dir / 'src'
    
    # Set defaults relative to this file
    if output_dir is None:
        output_dir = str(project_root / 'public')
    if input_folder is None:
        input_folder = str(udim_cv_dir / 'articles')
    if methods is None:
        methods = ['pca']
    if dimensions is None:
        dimensions = [3]
    if config_path is None:
        config_path = str(udim_cv_dir / 'config.toml')
    
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)
    
    # Load configuration
    config = load_config(Path(config_path))
    
    # Normalize base_url (use command-line override if provided, otherwise use config)
    if 'site' not in config:
        config['site'] = {}
    if base_url is not None:
        # Use command-line override
        base_url = normalize_base_url(base_url)
    else:
        # Use config file value
        base_url = normalize_base_url(config['site'].get('base_url', ''))
    config['site']['base_url'] = base_url
    
    # Step 1: Copy source files and render templates
    copy_source_files(src_dir, output_path, config)
    
    # Step 2: Run processing pipeline (if not copy_only)
    if not copy_only:
        print("🔄 Running processing pipeline...")
        embeddings_file = str(output_path / 'embeddings.json')
        
        try:
            process_main(
                input_folder=input_folder,
                output_file=embeddings_file,
                methods=methods,
                dimensions=dimensions,
                skip_confirmation=skip_confirmation,
                base_url=base_url
            )
            print("\n✅ Build complete!")
            print(f"📦 Output directory: {output_path}")
            print(f"📊 Embeddings file: {embeddings_file}")
        except Exception as e:
            print(f"\n❌ Error during processing: {e}")
            raise
    else:
        print("✅ Build complete (source files only)")
        print(f"📦 Output directory: {output_path}")
        print("\n💡 To generate embeddings, run:")
        print(f"   python -m udim_cv.process -i {input_folder} -o {output_path}/embeddings.json --methods {' '.join(methods)} --dimensions {' '.join(map(str, dimensions))} -s")


def _run():
    """Main entrypoint for command-line interface"""
    parser = argparse.ArgumentParser(
        description='Build static site: copy source files and generate embeddings',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Full build with default settings
  python -m udim_cv.build
  
  # Build with custom methods and dimensions
  python -m udim_cv.build --methods pca umap --dimensions 2 3
  
  # Build with custom input/output directories
  python -m udim_cv.build -i articles/ -o build/public/
  
  # Copy source files only (skip processing)
  python -m udim_cv.build --copy-only
        """
    )
    
    # Calculate default paths relative to this file
    udim_cv_dir = Path(__file__).parent
    project_root = udim_cv_dir.parent
    default_input = str(udim_cv_dir / 'articles')
    default_output = str(project_root / 'public')
    
    parser.add_argument(
        '--input', '-i',
        type=str,
        default=None,
        help=f'Input folder containing markdown files (default: {default_input})'
    )
    
    parser.add_argument(
        '--output', '-o',
        type=str,
        default=None,
        help=f'Output directory for build (default: {default_output})'
    )
    
    parser.add_argument(
        '--methods',
        type=str,
        nargs='+',
        choices=['pca', 'tsne', 'umap'],
        default=['pca'],
        help='Dimensionality reduction methods to use (default: pca)'
    )
    
    parser.add_argument(
        '--dimensions', '-d',
        type=int,
        nargs='+',
        choices=[2, 3],
        default=[3],
        help='Output dimensions (2D and/or 3D) (default: 3)'
    )
    
    parser.add_argument(
        '--skip-confirmation', '-s',
        action='store_true',
        help='Skip confirmation prompts'
    )
    
    parser.add_argument(
        '--copy-only',
        action='store_true',
        help='Only copy source files, skip processing pipeline'
    )
    
    parser.add_argument(
        '--config', '-c',
        type=str,
        default=None,
        help='Path to config.toml file (default: config.toml relative to build.py)'
    )
    
    parser.add_argument(
        '--base-url',
        type=str,
        default=None,
        help='Base URL for deployment (overrides config file value, e.g., "/subfolder")'
    )
    
    args = parser.parse_args()
    
    build(
        input_folder=args.input,
        output_dir=args.output,
        methods=args.methods,
        dimensions=args.dimensions,
        skip_confirmation=args.skip_confirmation,
        copy_only=args.copy_only,
        config_path=args.config,
        base_url=args.base_url
    )


if __name__ == '__main__':
    _run()
