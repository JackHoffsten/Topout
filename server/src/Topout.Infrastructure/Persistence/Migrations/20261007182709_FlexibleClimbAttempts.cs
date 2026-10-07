using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Topout.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class FlexibleClimbAttempts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "Attempts",
                table: "ClimbLogs",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer"
            );

            migrationBuilder.AddColumn<string>(
                name: "AttemptsMode",
                table: "ClimbLogs",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "Exact"
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM "ClimbLogs" WHERE "AttemptsMode" <> 'Exact') THEN
                        RAISE EXCEPTION 'Cannot downgrade while unknown or more-than attempts exist.';
                    END IF;
                END $$;
                """
            );
            migrationBuilder.DropColumn(name: "AttemptsMode", table: "ClimbLogs");

            migrationBuilder.AlterColumn<int>(
                name: "Attempts",
                table: "ClimbLogs",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true
            );
        }
    }
}
