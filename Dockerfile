FROM node:22

# Copy application dependency manifests to the container image.
# A wildcard is used to ensure both package.json AND package-lock.json are copied.
# Copying this separately prevents re-running npm install on every code change.

COPY . .

# Install production dependencies.
RUN npm install --omit-dev

# Run the web service on container startup.
CMD [ "npm", "run", "start" ]

# Document that the service listens on port 8080.
EXPOSE 3000