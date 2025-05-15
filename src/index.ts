import { app } from './app';

const port = 3003;

app.listen(port, () => {
  return console.log(`Express is listening at http://localhost:${port}`);
});
