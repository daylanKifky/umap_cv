import os

# Project descriptions organized by category
PROGRAMMING_PROJECTS = {
    'python_web_scraper.md': 'Built a distributed web scraping system using Scrapy and Redis. Handles rate limiting, proxy rotation, and data validation. Processes 1M pages daily with 99.9% uptime.',
    'python_trading_bot.md': 'Cryptocurrency trading bot using reinforcement learning. Implements custom strategies with real-time market data analysis. Achieved 15% monthly return in backtesting.',
    'python_cv_toolkit.md': 'Computer vision library for medical image processing. Features include tumor detection and 3D reconstruction. Used in 5 research institutions.',
    'js_react_dashboard.md': 'Real-time analytics dashboard with React and Socket.IO. Supports custom widget creation and dynamic theming. Used by 10K+ daily active users.',
    'js_node_backend.md': 'Scalable microservices architecture using Node.js and MongoDB. Handles 5K requests per second with automated failover.',
    'cpp_physics_sim.md': 'Particle physics simulation engine with CUDA acceleration. Models million-particle systems in real-time. Used in scientific visualization.',
    'rust_blockchain.md': 'Implemented a custom blockchain protocol in Rust. Features smart contracts and proof-of-stake consensus. Processes 1000 TPS.',
    'go_distributed_cache.md': 'Distributed caching system in Go. Supports automatic sharding and leader election. Used in production serving 50TB of data.',
}

BLENDER_PROJECTS = {
    'blender_nature_doc.md': 'Created photorealistic nature documentary scenes. Includes procedural ecosystems and particle-based wildlife. 4K resolution renders.',
    'blender_product_viz.md': 'Product visualization pipeline for e-commerce. Automated rendering system for 1000+ products. Includes material presets.',
    'blender_arch_viz.md': 'Architectural visualization project for modern housing. Features dynamic lighting and realistic materials. Used for international design competition.',
    'blender_character_animation.md': 'Character animation series with custom rigs. Includes facial motion capture integration. 10-minute short film.',
}

AFTER_EFFECTS_PROJECTS = {
    'ae_motion_graphics.md': 'Corporate branding package with dynamic logo animations. Includes social media templates and broadcast packages.',
    'ae_vfx_composite.md': 'Visual effects compositing for short film. Includes particle systems and color grading. Won regional film festival award.',
    'ae_infographics.md': 'Animated infographics series for educational content. Features data-driven animations and custom expressions.',
}

TRADITIONAL_ANIMATION = {
    'traditional_watercolor.md': 'Watercolor animation exploring themes of memory. 2-minute piece combining traditional and digital techniques.',
    'traditional_stopmotion.md': 'Stop-motion animation using paper cutouts. Commentary on environmental issues. Featured in art galleries.',
}

def create_project_files():
    # Ensure articles directory exists
    os.makedirs('articles', exist_ok=True)
    
    # Combine all project categories
    all_projects = {
        **PROGRAMMING_PROJECTS,
        **BLENDER_PROJECTS,
        **AFTER_EFFECTS_PROJECTS,
        **TRADITIONAL_ANIMATION
    }
    
    # Create each project file
    for filename, content in all_projects.items():
        filepath = os.path.join('articles', filename)
        with open(filepath, 'w') as f:
            f.write(f"# {filename.replace('.md', '').replace('_', ' ').title()}\n\n{content}")
    
    print(f"Created {len(all_projects)} project files in the articles directory.")

if __name__ == "__main__":
    create_project_files()
