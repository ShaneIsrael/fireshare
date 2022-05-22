from .__init__.py import create_app

if __name__ == "__main__":
  app = create_app()
  app.run(threaded=True)