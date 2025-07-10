// Add missing NodeJS platform APIs to quickjs for ribackup

#include "quickjs.h"
#include <unistd.h>
#include <stdlib.h>

#define countof( x ) ( sizeof( x ) / sizeof( ( x )[ 0 ]) )

// Module functions

// exit

static JSValue exit_func(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
	int exit_code = 0;
	if (argc > 0)
			JS_ToInt32(ctx, &exit_code, argv[0]);
	exit(exit_code);
	return JS_UNDEFINED;
}

// cwd

static JSValue cwd_func(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
		char *cwd = getcwd(NULL, 0); // Allocates buffer as needed
		JSValue ret = JS_NewString(ctx, cwd);
		free(cwd);
    return ret;
}

// helper functions for spawn

char **js_array_to_c_string_array(JSContext *ctx, JSValue js_array, size_t *argc_out) {
	if (!JS_IsArray(ctx, js_array)) {
			*argc_out = 0;
			return NULL;
	}

	JSValue jsLen = JS_GetPropertyStr(ctx, js_array, "length");
	int len;
	JS_ToInt32(ctx, &len, jsLen);
	JS_FreeValue(ctx, jsLen);


	char **c_array = calloc(len + 1, sizeof(char *)); // +1 for NULL terminator
		if (!c_array) {
				*argc_out = 0;
				return NULL;
		}

	for (uint32_t i = 0; i < len; ++i) {
			JSValue item = JS_GetPropertyUint32(ctx, js_array, i);
			if (JS_IsString(item)) {
				const char *str = JS_ToCString(ctx, item);
				if (str) {
					c_array[i] = strdup(str); // Copy string for later freeing
					JS_FreeCString(ctx, str);
				} else {
					c_array[i] = NULL;
				}
			} else {
				c_array[i] = NULL;
			}
			JS_FreeValue(ctx, item);
	}

	c_array[len] = NULL; // NULL-terminate
	*argc_out = len;
	return c_array;
}

void free_c_string_array(char **arr) {
	if (!arr) return;
	for (char **p = arr; *p; ++p) free(*p);
	free(arr);
}

// spawn

static JSValue spawn_func(JSContext *ctx, JSValueConst this_val, int argc, JSValueConst *argv) {
	size_t c_argc;
	char **c_argv = js_array_to_c_string_array(ctx, argv[0], &c_argc);

	int pipe_stdin[2], pipe_stdout[2], pipe_stderr[2];
	pipe(pipe_stdin);   // For child's stdin
	pipe(pipe_stdout);  // For child's stdout
	pipe(pipe_stderr);  // For child's stderr

	pid_t pid ;
	pid = fork();
	if (pid == -1) {
		perror("fork");
		return JS_EXCEPTION;
}
	if(pid == 0) { //child
		dup2(pipe_stdin[0], STDIN_FILENO);
		dup2(pipe_stdout[1], STDOUT_FILENO);
		dup2(pipe_stderr[1], STDERR_FILENO);

		// Close unused pipe ends
		close(pipe_stdin[0]);
		close(pipe_stdin[1]);
		close(pipe_stdout[0]);
		close(pipe_stdout[1]);
		close(pipe_stderr[0]);
		close(pipe_stderr[1]);
		execvp(c_argv[0], c_argv);
		free_c_string_array(c_argv); // execvp failed
		perror("execvp failed");
		exit(1);
	} else { //parent
		close(pipe_stdin[0]);
		close(pipe_stdout[1]);
		close(pipe_stderr[1]);

		JSValue js_arr = JS_NewArray(ctx);
		JS_SetPropertyUint32(ctx, js_arr, 0, JS_NewInt32(ctx, pipe_stdin[1]));
		JS_SetPropertyUint32(ctx, js_arr, 1, JS_NewInt32(ctx, pipe_stdout[0]));
		JS_SetPropertyUint32(ctx, js_arr, 2, JS_NewInt32(ctx, pipe_stderr[0]));
		JS_SetPropertyUint32(ctx, js_arr, 3, JS_NewInt32(ctx, pid));
		return js_arr;
	}
}

static const JSCFunctionListEntry module_funcs[] = {
    JS_CFUNC_DEF("exit", 1, exit_func),
    JS_CFUNC_DEF("dirname", 0, cwd_func),
		JS_CFUNC_DEF("spawn", 1, spawn_func)
};

// Pipe Class

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

static const JSCFunctionListEntry js_pipe_proto_funcs[] = {
	JS_CFUNC_DEF( "read", 0, js_pipe_read ),
	JS_CFUNC_DEF( "write", 1, js_pipe_write ),
	JS_CFUNC_DEF( "close", 0, js_pipe_close )
};

static int js_module_init( JSContext *ctx,  JSModuleDef *m )
{
	// Register module functions (exit, cwd)
	JS_SetModuleExportList(ctx, m, module_funcs, sizeof(module_funcs)/sizeof(JSCFunctionListEntry));

	//Register the Pipe class
	JS_NewClassID( &js_pipe_class_id );
	JS_NewClass( JS_GetRuntime( ctx ), js_pipe_class_id, &js_pipe_class );

	JSValue pipe_proto = JS_NewObject( ctx );
	JS_SetPropertyFunctionList( ctx, pipe_proto, js_pipe_proto_funcs, countof( js_pipe_proto_funcs ) );

	JSValue pipe_class = JS_NewCFunction2( ctx, js_pipe_ctor, "Pipe", 2, JS_CFUNC_constructor, 0 );
	JS_SetConstructor(ctx, pipe_class, pipe_proto);
	JS_SetClassProto( ctx, js_pipe_class_id, pipe_proto );

	JS_SetModuleExport(ctx, m, "Pipe", pipe_class);
  return 0;
}

#ifdef JS_SHARED_LIBRARY
#define JS_INIT_MODULE js_init_module
#else
#define JS_INIT_MODULE js_init_module_qjsPlatform
#endif

// Module init function

JSModuleDef *JS_INIT_MODULE(JSContext *ctx, const char *module_name)
{
    JSModuleDef *m;
    m = JS_NewCModule(ctx, module_name, js_module_init);
    if (!m)
        return NULL;
    JS_AddModuleExportList(ctx, m, module_funcs, countof(module_funcs));
		JS_AddModuleExport(ctx, m, "Pipe");
    return m;
}
