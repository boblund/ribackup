QJSC = qjsc
CC = gcc
QJS_BASE = $(shell ./qjs_env.sh)
CFLAGS = -I$(QJS_BASE)/include/quickjs
LDFLAGS = -L$(QJS_BASE)/lib/quickjs -lquickjs -lm -lpthread -ldl

.PHONY: all clean

TARGET = ribackup
TARGET_MJS = ../$(TARGET).mjs
JS_MODULE = qjsPlatform
C_SRC = $(JS_MODULE).c $(TARGET).c

all: $(TARGET)

$(TARGET).c:  $(TARGET_MJS)
	$(QJSC)  -e -m -o $(TARGET).c $(TARGET_MJS)
	./add_js_init.sh $(JS_MODULE) $(TARGET).c

$(TARGET): $(C_SRC)
	$(CC) $(CFLAGS) $(C_SRC) $(LDFLAGS) -o $(TARGET)

clean:
	rm -f $(TARGET) $(TARGET).c*
