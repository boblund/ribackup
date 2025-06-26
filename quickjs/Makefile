QJSC = qjsc
QJSC_FLAGS = -m -e -o ribackup.c
JS_SRC = ../ribackup.mjs

CC = gcc
QJS_BASE = $(shell ./qjs_env.sh)
CFLAGS = -I$(QJS_BASE)/include/quickjs
LDFLAGS = -L$(QJS_BASE)/lib/quickjs -lquickjs -lm -lpthread -ldl
SRC = process.c ribackup.c
OUT = ribackup

.PHONY: all clean

all: $(OUT)

ribackup.c: $(JS_SRC)
	$(QJSC) $(QJSC_FLAGS) $(JS_SRC)
	./add_js_init.sh create_global_process_object ribackup.c

$(OUT): $(SRC)
	$(CC) $(CFLAGS) $(SRC) $(LDFLAGS) -o $(OUT)

clean:
	rm -f ribackup.c* $(OUT)
