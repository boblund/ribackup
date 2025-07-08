QJSC = qjsc
CC = gcc
QJS_BASE = $(shell ./qjs_env.sh)
CFLAGS = -I$(QJS_BASE)/include/quickjs
LDFLAGS = -L$(QJS_BASE)/lib/quickjs -lquickjs -lm -lpthread -ldl

.PHONY: all clean

TARGET = ribackup
TARGET_MJS = ../$(TARGET).mjs

all: $(TARGET)

$(TARGET).c:  $(TARGET_MJS)
	$(QJSC)  -e -m -o $(TARGET).c $(TARGET_MJS)
	./add_js_init.sh qjsPlatform $(TARGET).c

$(TARGET).o: $(TARGET).c
	$(CC) $(CFLAGS) -c -o $(TARGET).o $(TARGET).c

qjsPlatform.o: qjsPlatform.c
	$(CC) $(CFLAGS) -c -o qjsPlatform.o qjsPlatform.c

$(TARGET): $(TARGET).o qjsPlatform.o
	$(CC) $(LDFLAGS) -o $(TARGET) *.o

clean:
	rm -f rm -f $(TARGET) $(TARGET).c* $(TARGET).o qjsPlatform.o
