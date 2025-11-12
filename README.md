# Projects Latent Space viz

![latent_portfolio preview](latent_portfolio/public/latent_portfolio_prev.jpg)

## Dev Run: 

```bash
pip install -e .

python -m latent_portfolio.process --input latent_portfolio/articles --output latent_portfolio/public/embeddings.json

cd latent_portfolio/public

python -m http.server 8080

```

