# Contributing

Thank you for considering a contribution to FloDo (Django Admin Dashboard).

## Ways to contribute

- Report bugs and request features via GitHub Issues
- Improve documentation in `docs/`
- Tackle good first issues and enhancements

## Development setup

```bash
python -m venv .venv
. .venv/Scripts/Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Run tests:

```bash
python manage.py test
```

## Coding standards

- Python: PEP8; use `black` and `flake8` if available
- Security: always include CSRF tokens for non‑GET requests, validate inputs
- Frontend: Vanilla JS (Fetch), prefer `textContent` over `innerHTML` for dynamic content

## Pull Requests

- Fork the repo and create a branch: `feat/<short-name>` or `fix/<short-name>`
- Keep PRs focused and include screenshots for UI changes
- Update or add docs in `docs/` when relevant

## Commit messages

- Conventional style preferred, e.g., `feat: add export to CSV`, `fix: avatar upload CSRF`

## License

- By contributing, you agree your contributions will be licensed under the repository’s license.
