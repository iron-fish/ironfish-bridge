## Development

Ensure you are running [Node 18.x.](https://nodejs.org/en/download/) or greater and install [Yarn](https://yarnpkg.com/getting-started/install).

### Local Node Changes

If you need to test changes to both the [`ironfish`
SDK](https://github.com/iron-fish/ironfish/tree/master/ironfish) and
`ironfish-bridge/cli`, link this project to a local copy of the `ironfish` SDK
using the following steps:

In the [`ironfish`](https://github.com/iron-fish/ironfish/) repository:

```bash
# Build all packages
$ yarn build

# Navigate to the SDK directory
$ cd ironfish

# Link the SDK package
$ yarn link
```

In `ironfish-bridge/cli` directory:

```bash
$ yarn link "@ironfish/sdk"
```

### Docker

Run `scripts/build-docker.sh` to build the Docker image

To build a Docker image that depends on local changes in the `ironfish` repo, run the steps in the section above before running the build script.
