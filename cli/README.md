## Development
Ensure you are running Node 18.x.

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