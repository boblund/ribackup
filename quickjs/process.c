#include "quickjs.h"
#include <unistd.h>
#include <stdlib.h>
#include <stdbool.h>

#define countof( x ) ( sizeof( x ) / sizeof( ( x )[ 0 ]) )

static JSValue exit_func(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
	int exit_code = 0;
	if (argc > 0)
			JS_ToInt32(ctx, &exit_code, argv[0]);
	exit(exit_code);
	return JS_UNDEFINED;
}

/* Pipe Class */

typedef struct {
	FILE *f;
} JSPipeData;

static JSClassID js_pipe_class_id;

static void js_pipe_finalizer( JSRuntime *rt, JSValue val )
{
	JSPipeData *pd = JS_GetOpaque( val, js_pipe_class_id );
	js_free_rt( rt, pd );
}

static JSValue js_pipe_ctor( JSContext *ctx,
														 JSValueConst new_target,
														 int argc, JSValueConst *argv)
{
	JSPipeData *pd;
	JSValue obj = JS_UNDEFINED;
	JSValue proto;
	const char *cmd, *mode;
	FILE *p;

	pd = js_malloc( ctx, sizeof( *pd ) );
	if( !pd )
		return JS_EXCEPTION;
	cmd = JS_ToCString(ctx, argv[ 0 ] );
	if( !cmd )
		goto fail;
	mode = JS_ToCString(ctx, argv[ 1 ] );
	if( !mode )
		goto fail;
	if (mode[strspn(mode, "rw")] != '\0') {
		goto fail;
  }

  p = popen(cmd, mode);
  JS_FreeCString(ctx, cmd);
  JS_FreeCString(ctx, mode);
  if (!p) {
    goto fail;
  }
	pd->f = p;

	proto = JS_GetPropertyStr( ctx, new_target, "prototype" );
	if (JS_IsException(proto))
		goto fail;
	obj = JS_NewObjectProtoClass( ctx, proto, js_pipe_class_id );
	JS_FreeValue(ctx, proto);
	if (JS_IsException(obj))
			goto fail;
	JS_SetOpaque(obj, pd);
	return obj;
 fail:
    js_free(ctx, pd);
    JS_FreeValue(ctx, obj);
    return JS_EXCEPTION;
}

void js_free_func(JSRuntime *rt, void *opaque, void *ptr) {
    free(ptr);
}

static JSValue js_pipe_read( JSContext *ctx, JSValueConst this_val,
                             int argc, JSValueConst *argv )
{
    char buffer[4096];
		int len;

		JSPipeData *pd = JS_GetOpaque2( ctx, this_val, js_pipe_class_id );
		len = fread( buffer, 1, 4096, pd->f );
		if( len > 0 ) {
			uint8_t *buf = malloc(len);
			memcpy(buf, buffer, len);
			return JS_NewArrayBuffer(ctx, buf, len, js_free_func, NULL, 0);
    } else {
			return JS_UNDEFINED;
		}
}

static JSValue js_pipe_write( JSContext *ctx, JSValueConst this_val,
                             int argc, JSValueConst *argv)
{
		JSPipeData *pd = JS_GetOpaque2( ctx, this_val, js_pipe_class_id );
		size_t size;
		uint8_t *data = JS_GetArrayBuffer(ctx, &size, argv[0]);
    if (!data) {
        return JS_EXCEPTION;
    }
    size_t written = fwrite(data, 1, size, pd->f);
    if (written != size) {
        return JS_EXCEPTION;
    }
		return JS_UNDEFINED;
}

static JSValue js_pipe_close( JSContext *ctx, JSValueConst this_val,
                             int argc, JSValueConst *argv )
{
	JSPipeData *pd = JS_GetOpaque2( ctx, this_val, js_pipe_class_id );
	return JS_NewInt64(ctx, pclose( pd->f ) );
}

static JSClassDef js_pipe_class = {
    "Pipe",
    .finalizer = js_pipe_finalizer,
};

static const JSCFunctionListEntry funcs[] = {
	JS_CFUNC_DEF( "read", 0, js_pipe_read ),
	JS_CFUNC_DEF( "write", 1, js_pipe_write ),
	JS_CFUNC_DEF( "close", 0, js_pipe_close )
};

JSValue pipe_proto, pipe_class;

static int js_pipe_init( JSContext *ctx )
{
	JS_NewClassID( &js_pipe_class_id );
	JS_NewClass( JS_GetRuntime( ctx ), js_pipe_class_id, &js_pipe_class );
	pipe_proto = JS_NewObject( ctx );
	JS_SetPropertyFunctionList( ctx, pipe_proto, funcs, countof( funcs ) );
	pipe_class = JS_NewCFunction2( ctx, js_pipe_ctor, "Pipe", 2, JS_CFUNC_constructor, 0 );
	JS_SetConstructor(ctx, pipe_class, pipe_proto);
  JS_SetClassProto( ctx, js_pipe_class_id, pipe_proto );
  return 0;
}

static const JSCFunctionListEntry process_props[] = {
    JS_CFUNC_DEF("exit", 1, exit_func)
};

static const JSCFunctionListEntry global_props[] = {
    JS_OBJECT_DEF("process", process_props, sizeof(process_props)/sizeof(JSCFunctionListEntry), JS_PROP_WRITABLE | JS_PROP_CONFIGURABLE),
};

void create_global_process_object(JSContext *ctx) {
		js_pipe_init( ctx );
    JSValue global_obj = JS_GetGlobalObject(ctx);
    JS_SetPropertyFunctionList(ctx, global_obj, global_props, sizeof(global_props)/sizeof(JSCFunctionListEntry));
		JS_SetPropertyStr(ctx, global_obj, "Pipe", pipe_class);
		char *cwd = getcwd(NULL, 0); // Allocates buffer as needed
    if (cwd != NULL) {
        JS_SetPropertyStr(ctx,  global_obj, "dirname", JS_NewString(ctx, cwd));
        free(cwd);
		}
    JS_FreeValue(ctx, global_obj);
}
