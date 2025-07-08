#!/bin/bash

#!/bin/bash

# $1 = module name
# $2 = c file with main() generated from js

SED_CMD=$( ( if [[ $(sed --version) =~ 'GNU sed' ]]; then echo "sed -i"; else echo "sed -i ''"; fi ) 2>/dev/null)
${SED_CMD} "/return ctx;/i\\
	{ \\
    extern JSModuleDef *js_init_module_${1}(JSContext *ctx, const char *name); \\
    js_init_module_${1}(ctx, \"${1}\"); \\
  }
" $2
