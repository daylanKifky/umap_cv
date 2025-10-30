# Projects Latent Space viz

![udim_cv preview](udim_cv/public/udim_cv_prev.jpg)

## Dev Run: 

```bash
pip install -e .

python -m udim_cv.process --input udim_cv/articles --output udim_cv/public/embeddings.json

cd udim_cv/public

python -m http.server 8080

```

