#!/bin/bash

# $1 = js_init_function name
# $2 = c file with main() generated from js

SED_CMD=$( ( if [[ $(sed --version) =~ 'GNU sed' ]]; then echo "sed -i"; else echo "sed -i ''"; fi ) 2>/dev/null)
${SED_CMD} "/#include \"quickjs-libc.h\"/a\\
void $1(JSContext *);
/ctx = JS_NewCustomContext(rt);/a\\
$1( ctx );
" $2
