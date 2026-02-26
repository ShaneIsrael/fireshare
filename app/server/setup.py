from setuptools import setup, find_packages

def read_requirements():
    with open("requirements.txt", "r") as f:
        return [line.strip() for line in f if line.strip() and not line.startswith("#")]

setup(
    name="fireshare",
    version="1.0",
    packages=find_packages(),
    entry_points={
        "console_scripts": [
            "fireshare=fireshare.cli:cli"
        ]
    },
    install_requires=read_requirements(),
)
