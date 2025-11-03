#!/usr/bin/env python3
"""
Build script to prepare static site for deployment.
Copies source files from src/ to public/ and runs the processing pipeline.
"""

import shutil
import argparse
from pathlib import Path
from typing import List

# Import process module
from .process import main as process_main


def copy_source_files(src_dir: Path, public_dir: Path):
    """
    Copy all source files from src/ to public/.
    
    Args:
        src_dir: Source directory (udim_cv/src)
        public_dir: Output directory (udim_cv/public)
    """
    print("🏗️  Building static site...")
    
    # Ensure public directory exists
    public_dir.mkdir(exist_ok=True)
    
    # 1. Copy HTML template
    print("📄 Copying HTML template...")
    template = src_dir / 'templates' / 'index.html'
    if template.exists():
        shutil.copy(template, public_dir / 'index.html')
        print(f"  ✓ {template.name}")
    else:
        print(f"  ⚠ Warning: {template} not found")
    
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
    copy_only: bool = False
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
    
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)
    
    # Step 1: Copy source files
    copy_source_files(src_dir, output_path)
    
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
                skip_confirmation=skip_confirmation
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
    
    args = parser.parse_args()
    
    build(
        input_folder=args.input,
        output_dir=args.output,
        methods=args.methods,
        dimensions=args.dimensions,
        skip_confirmation=args.skip_confirmation,
        copy_only=args.copy_only
    )


if __name__ == '__main__':
    _run()
