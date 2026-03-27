# Local dev setup instructions

## To open workspace:

- Open VS code
- File -> Open workspace from file
- Select transaction-manager.code-workspace

## Install dependencies

Powershell might give you an error during npm install about rights to run npm commands. To fix that, run the following command:

    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

In order to install dependencies, we need to run:

    cd transaction-ui
    npm install
    cd ..
    cd transaction-api
    npm install

To re-generate prisma client files:

    cd transaction-ui
    npx prisma generate

## Configure environment

A .env.example file has been provided in both of the projects. Use it as a template to create a .env file in both of them.

For the UI, point the REACT_APP_API_BASE to the location of the back-end. If you run both of them locally, it should be http://localhost:5000

For the API, we need to provide the postgres connection string.

## Run

To run both projects, go to Run and Debug tab and start Debug API + UI.

Otherwise, run each project with:

    npm start

