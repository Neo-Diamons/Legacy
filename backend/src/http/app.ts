import { OpenAPIHono } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';

type DefaultHook = NonNullable<ConstructorParameters<typeof OpenAPIHono>[0]>['defaultHook'];

const defaultHook: DefaultHook = (result, c) => {
  if (!result.success) {
    return c.json(
      {
        message: 'Validation failed',
        issues: result.error.issues.map((i) => ({ path: i.path.map(String), message: i.message })),
      },
      422
    );
  }
};

export const createRouter = () => new OpenAPIHono({ defaultHook });

export const registerErrorHandler = (app: OpenAPIHono) => {
  app.notFound((c) => c.json({ message: 'Not found' }, 404));

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ message: err.message }, err.status);
    }
    console.error(err);
    return c.json({ message: 'Internal server error' }, 500);
  });
};
