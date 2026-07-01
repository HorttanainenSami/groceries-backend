# How CD works

In developement stage, we use feature/ branch naming so the CI will run the tests for that branch.

When branch is merged to master CD will run and it will create new docker image of the backend nodejs app and publish it to Github repository.

After that github actions is connecting to VPS via SSH and it is making bakcup of the current database snapshot and then it is upgrading app and migrating database.
