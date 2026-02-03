# ClawTrap Cowrie SSH Honeypot
FROM cowrie/cowrie:latest

# Copy custom configuration
COPY cowrie.cfg /cowrie/cowrie-git/etc/cowrie.cfg

# Expose SSH port
EXPOSE 2222

# The base image already sets up the entrypoint
# Fake files will be mounted via docker-compose volumes
