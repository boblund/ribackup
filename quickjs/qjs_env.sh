# returns location of quickjs lib and include directories

path=$(which qjsc 2>/dev/null)
case "$path" in
  *homebrew*)
    echo $(brew list quickjs|grep -m 1 include|sed -e 's/\(^.*\)include.*/\1/')
    ;;
	/usr/local*)
		echo /usr/local
		;;
  *)
    echo ""
    ;;
esac
