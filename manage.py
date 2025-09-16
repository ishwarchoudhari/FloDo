#!/usr/bin/env python
"""
manage.py - Django's command-line utility for administrative tasks.
Every line includes comments for clarity.
"""
import os  # Standard library import for environment manipulation
import sys  # Standard library import to access command-line args


def main():
    """Run administrative tasks."""
    # Set default settings module so Django knows where configuration lives.
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "django_admin_project.settings")
    try:
        # Import Django's command execution function.
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        # Provide a helpful error if Django isn't installed or venv issues arise.
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and available on your PYTHONPATH environment variable? "
            "Did you forget to activate a virtual environment?"
        ) from exc
    # Execute the command line utility with system arguments (e.g., runserver, migrate).
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    # Entrypoint guard to ensure main() runs when executing this file directly.
    main()
