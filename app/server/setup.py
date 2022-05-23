from setuptools import setup, find_packages
import pkg_resources
import pathlib

with pathlib.Path('requirements.txt').open() as requirements_txt:
    install_requires = [
        str(requirement)
        for requirement
        in pkg_resources.parse_requirements(requirements_txt)
    ]

setup(
    name="fireshare",
    version="1.0",
    packages=find_packages(),
    entry_points={
        "console_scripts": [
            "fireshare=fireshare.cli:cli"
        ]
    },
    install_requires=install_requires,
)