#!/usr/bin/env perl
use strict;
use warnings;

use feature 'say';

# use Sugar::IO::File;

use IO::File;
use MIME::Base64;


# my $html = Sugar::IO::File->new(shift // die "html file required")->read;
my $file = shift // die "html file required";
my $html = `cat $file`;
# $html =~ s#(<script\b[^<>]+)src="([^"]+)"([^<>]*>)</script>#"$1$3" . Sugar::IO::File->new($2)->read . "</script>"#gse;



my @js_sources;
# my $js = '';
while ($html =~ m#(<script\b[^<>]+)src="([^"]+)"([^<>]*>)</script>#gs) {
	push @js_sources, $2;
	# $js .= `cat $2`;

	# $js .= `./min/optimize_out_functions.pl $2 --compress --mangle`;
	# $js .= `./min/node_modules/uglify-js/bin/uglifyjs $2 --compress --mangle`;
	# say "script: $js";
}
my $sources = join ' ', @js_sources;
# my $js = `./min/optimize_out_functions.pl $sources | ./min/node_modules/uglify-js/bin/uglifyjs --mangle-props --mangle --compress --toplevel`;
my $js = `./min/optimize_out_functions.pl $sources | ./min/node_modules/uglify-js/bin/uglifyjs --mangle-props --mangle --compress --toplevel | ./min/lzw_compress.js`;
my $js_raw .= `cat $sources`;


my $prefix = `cat ./min/lzw_decompress.js | ./min/node_modules/uglify-js/bin/uglifyjs --mangle --compress`;
$js = "$prefix\neval(LZW.decode(`$js`))";
$js = "<script>$js</script>";

$html =~ s#(<script\b[^<>]+)src="([^"]+)"([^<>]*>)</script>##gs;


my $additions = '';
foreach my $arg ($js_raw =~ m#assets/[^'"]+\.png#sg) {
	# say "img: $arg";
	my $data = `cat $arg`;
	$additions .= "<img style='display:none' data-url='$arg' src='data:image/png;base64," . encode_base64($data, '') . "' />\n";
}

die "failed to find <head> tag" unless $html =~ s#(<head>)#$1$js#s;
die "failed to find <head> tag" unless $html =~ s/(<head>)/$1$additions/s;

# IO::File->new("./min/temp.html", 'w')->print("$additions$js");
# my $head = `cat ./min/temp.html | ./min/lzw_compress.js`;
# my $stub = "<script>$prefix\nwindow.onload=() => document.head.innerHTML=LZW.decode(`$head`)</script>";
# die "failed to find <head> tag" unless $html =~ s/(<head>)/$1$stub/s;
# say "$additions$js";

say $html;

