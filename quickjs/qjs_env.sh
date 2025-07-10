# returns location of quickjs lib and include directories
echo `which qjsc` | perl -F'/' -ane 'print "/" . join("/", $F[1], $F[2])'
#echo `which qjsc` | sed -E 's|^(/[^/]+/[^/]+).*|\1|'
#path=$(which qjsc 2>/dev/null)
#case "$path" in
#  *homebrew*)
#    echo $(brew list quickjs|grep -m 1 include|sed -e 's/\(^.*\)include.*/\1/')
#    ;;
#	/usr/local*)
#		echo /usr/local
#		;;
#  *)
#    echo ""
#    ;;
#esac
